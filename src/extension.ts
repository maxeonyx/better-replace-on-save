// extension.ts
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ReplacementConfig {
	id?: string;  // Make id optional with ? syntax instead of string | undefined
	search?: string;
	replace?: string;
	languages?: string[];
}

// Export for testing
export { expandVariables };

// Global cache for merged replacements and file watchers
let cachedReplacements: ReplacementConfig[] = [];
let fileWatchers: vscode.FileSystemWatcher[] = [];

/**
 * Expand variables in file paths
 * Supports:
 * - ~/path -> {userHome}/path
 * - ${userHome}/path -> {userHome}/path
 * - ${env:VARIABLE_NAME}/path -> value of environment variable
 */
function expandVariables(filePath: string): string {
	let expandedPath = filePath;

	// Handle ~/path syntax
	if (expandedPath.startsWith('~/')) {
		expandedPath = path.join(os.homedir(), expandedPath.slice(2));
	}
	// Handle ${userHome} variable
	else if (expandedPath.includes('${userHome}')) {
		expandedPath = expandedPath.replace(/\$\{userHome\}/g, os.homedir());
	}

	// Handle ${env:VARIABLE_NAME} variables
	const envVarRegex = /\$\{env:([^}]+)\}/g;
	expandedPath = expandedPath.replace(envVarRegex, (match, varName) => {
		const envValue = process.env[varName];
		if (envValue === undefined) {
			console.warn(`Better Replace-on-Save: Environment variable ${varName} is not defined, keeping original path: ${match}`);
			return match; // Keep original if environment variable is not found
		}
		return envValue;
	});

	// Normalize the path to handle any consecutive slashes
	expandedPath = path.normalize(expandedPath);

	return expandedPath;
}

/**
 * Load replacements from an external file
 */
async function loadReplacementsFromFile(filePath: string): Promise<ReplacementConfig[]> {
	try {
		// First, expand variables in the file path
		let resolvedPath = expandVariables(filePath);
		
		// Then resolve relative paths relative to workspace root
		if (!path.isAbsolute(resolvedPath)) {
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (workspaceFolders && workspaceFolders.length > 0) {
				resolvedPath = path.join(workspaceFolders[0].uri.fsPath, resolvedPath);
			}
		}

		// Check if file exists
		if (!fs.existsSync(resolvedPath)) {
			console.warn(`Better Replace-on-Save: Replacements file not found: ${resolvedPath}`);
			return [];
		}

		// Read and parse file
		const fileContent = fs.readFileSync(resolvedPath, 'utf-8');
		const replacements = JSON.parse(fileContent);

		// Validate that it's an array
		if (!Array.isArray(replacements)) {
			console.warn(`Better Replace-on-Save: Invalid replacements file format (expected array): ${resolvedPath}`);
			return [];
		}

		// Validate each replacement object
		const validReplacements: ReplacementConfig[] = [];
		for (const replacement of replacements) {
			if (typeof replacement === 'object' && 
				typeof replacement.search === 'string' && 
				typeof replacement.replace === 'string') {
				validReplacements.push(replacement);
			} else {
				console.warn(`Better Replace-on-Save: Invalid replacement object in file ${resolvedPath}:`, replacement);
			}
		}

		return validReplacements;
	} catch (error) {
		console.error(`Better Replace-on-Save: Error loading replacements from file ${filePath}:`, error);
		return [];
	}
}

/**
 * Load and merge all replacements from settings and external files
 */
async function loadAllReplacements(): Promise<ReplacementConfig[]> {
	const config = vscode.workspace.getConfiguration('betterReplaceOnSave');
	
	// Get replacements from settings
	const settingsReplacements: ReplacementConfig[] = config.get('replacements') || [];
	
	// Get replacement files
	const replacementFiles: string[] = config.get('replacementsFiles') || [];
	
	// Load all file-based replacements
	const fileReplacements: ReplacementConfig[] = [];
	for (const filePath of replacementFiles) {
		const replacements = await loadReplacementsFromFile(filePath);
		fileReplacements.push(...replacements);
	}
	
	// Merge all replacements (settings first, then files)
	return [...settingsReplacements, ...fileReplacements];
}

/**
 * Setup file watchers for replacement files
 */
function setupFileWatchers(context: vscode.ExtensionContext): void {
	// Clean up existing watchers
	fileWatchers.forEach(watcher => watcher.dispose());
	fileWatchers = [];

	const config = vscode.workspace.getConfiguration('betterReplaceOnSave');
	const replacementFiles: string[] = config.get('replacementsFiles') || [];

	for (const filePath of replacementFiles) {
		// Expand variables and resolve relative paths
		let resolvedPath = expandVariables(filePath);
		if (!path.isAbsolute(resolvedPath)) {
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (workspaceFolders && workspaceFolders.length > 0) {
				resolvedPath = path.join(workspaceFolders[0].uri.fsPath, resolvedPath);
			}
		}

		try {
			const watcher = vscode.workspace.createFileSystemWatcher(resolvedPath);
			
			const reloadReplacements = async () => {
				cachedReplacements = await loadAllReplacements();
			};

			watcher.onDidCreate(reloadReplacements);
			watcher.onDidChange(reloadReplacements);
			watcher.onDidDelete(reloadReplacements);

			fileWatchers.push(watcher);
			context.subscriptions.push(watcher);
		} catch (error) {
			console.error(`Better Replace-on-Save: Error setting up file watcher for ${resolvedPath}:`, error);
		}
	}
}

export function activate(context: vscode.ExtensionContext) {
	// Load initial replacements
	loadAllReplacements().then(replacements => {
		cachedReplacements = replacements;
	});

	// Setup file watchers
	setupFileWatchers(context);

	// Watch for configuration changes
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(async (event) => {
			if (event.affectsConfiguration('betterReplaceOnSave')) {
				// Reload replacements when configuration changes
				cachedReplacements = await loadAllReplacements();
				
				// Re-setup file watchers if replacementsFiles changed
				if (event.affectsConfiguration('betterReplaceOnSave.replacementsFiles')) {
					setupFileWatchers(context);
				}
			}
		})
	);

	// Register the code action provider
	const provider = new ReplaceOnSaveCodeActionProvider();
	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider('*', provider, {
			providedCodeActionKinds: [vscode.CodeActionKind.Source]
		})
	);

	// Register the command that will be called by the code action
	context.subscriptions.push(
		vscode.commands.registerCommand('better-replace-on-save.applyReplacements', async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				return;
			}

			// When run from code action (on save), respect language filters
			await applyReplacements(editor, undefined, true);
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('better-replace-on-save.applySpecificReplacement', async (replacementId?: string, isCodeAction?: boolean) => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				return;
			}

			// If no replacement ID was provided, show quick pick to select from available replacements
			if (!replacementId) {
				// Filter replacements that have an ID
				const replacementsWithIds = cachedReplacements.filter(r => r.id !== undefined);

				if (replacementsWithIds.length === 0) {
					vscode.window.showInformationMessage('No replacement patterns with IDs configured.');
					return;
				}

				// Create quick pick items
				const quickPickItems = replacementsWithIds.map(r => ({
					label: r.id!,
					description: `${r.search} → ${r.replace}`,
					replacementId: r.id
				}));

				const selected = await vscode.window.showQuickPick(quickPickItems, {
					placeHolder: 'Select a replacement pattern to apply'
				});

				if (!selected) {
					return; // User canceled the selection
				}

				replacementId = selected.replacementId;
				// User-selected items are never from code actions
				isCodeAction = false;
			}

			// When called from on-save code action, isCodeAction will be true (passed by CodeActionProvider)
			// When called directly from command palette, isCodeAction will be undefined or false
			await applyReplacements(editor, replacementId, !!isCodeAction);
		})
	);
}

class ReplaceOnSaveCodeActionProvider implements vscode.CodeActionProvider {

	provideCodeActions(
		document: vscode.TextDocument,
		range: vscode.Range | vscode.Selection,
		context: vscode.CodeActionContext,
		token: vscode.CancellationToken,
	): vscode.CodeAction[] {
		const codeActionKind = vscode.CodeActionKind.Source.append('applyReplacements');
		if (!context.only?.intersects(codeActionKind)) {
			return [];
		}
		const mainAction = new vscode.CodeAction(
			'Apply all configured replacements',
			codeActionKind,

		);
		mainAction.command = {
			command: 'better-replace-on-save.applyReplacements',
			title: 'Apply configured replacements'
		};
		let actions: vscode.CodeAction[];
		if (context.only && context.only.contains(codeActionKind)) {
			actions = [mainAction];
		} else {
			actions = [];
		}

		const subActions = cachedReplacements.flatMap((replacement) => {
			if (replacement.id !== undefined && typeof replacement.id === 'string') {
				const subActionKind = codeActionKind.append(replacement.id);
				const subAction = new vscode.CodeAction(
					`Apply replacement: ${replacement.id}`,
					subActionKind,
				);
				subAction.command = {
					command: 'better-replace-on-save.applySpecificReplacement',
					title: 'Apply specific replacement',
					arguments: [replacement.id, true], // true indicates this is a code action
				};
				if (context.only && context.only.contains(subActionKind)) {
					return [subAction];
				}
			}
			return [];
		});

		return [...actions, ...subActions];
	}
}

async function applyReplacements(
	editor: vscode.TextEditor,
	specificReplacementId?: string,
	isCodeAction: boolean = false
): Promise<void> {
	const document = editor.document;
	const languageId = document.languageId;

	// Filter replacements based on language and specific ID if provided
	let applicableReplacements = cachedReplacements;

	// Apply specific ID filter if specified
	if (specificReplacementId) {
		applicableReplacements = applicableReplacements.filter(r => r.id === specificReplacementId);
	}

	// Apply language filter in two cases:
	// 1. No specific ID was provided
	// 2. A specific ID was provided AND this is a code action (e.g., on save)
	if (!specificReplacementId || (specificReplacementId && isCodeAction)) {
		applicableReplacements = applicableReplacements.filter(r =>
			!r.languages || r.languages.includes(languageId)
		);
	}

	if (applicableReplacements.length === 0) {
		return;
	}

	await editor.edit((editBuilder => {
		const text = document.getText();

		for (const replacement of applicableReplacements) {
            if (replacement.search === undefined) {
				console.warn(`Better Replace-on-Save: Missing search pattern for replacement`, replacement);
                continue;
            }

			const searchValue = new RegExp(replacement.search, 'gd');
			const results = text.matchAll(searchValue);
			for (const result of results) {
				const start = result.index;
				const end = result.index + result[0].length;
				const matchedText = text.substring(start, end);
				const replacementText = matchedText.replace(searchValue, replacement.replace ?? "");
				editBuilder.replace(new vscode.Range(document.positionAt(start), document.positionAt(end)), replacementText);
			}
		}
	}));
}

export function deactivate() { }
