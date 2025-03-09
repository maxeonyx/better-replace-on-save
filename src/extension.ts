// extension.ts
import * as vscode from 'vscode';

interface ReplacementConfig {
	id: string | undefined;
	search: string;
	replace: string;
	languages?: string[];
}

export function activate(context: vscode.ExtensionContext) {
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

			await applyReplacements(editor);
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('better-replace-on-save.applySpecificReplacement', async (replacementId?: string) => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				return;
			}

			// If no replacement ID was provided, show quick pick to select from available replacements
			if (!replacementId) {
				const config = vscode.workspace.getConfiguration('betterReplaceOnSave');
				const replacements: ReplacementConfig[] = config.get('replacements') || [];
				
				// Filter replacements that have an ID
				const replacementsWithIds = replacements.filter(r => r.id !== undefined);
				
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
			}
			
			await applyReplacements(editor, replacementId);
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

		const config = vscode.workspace.getConfiguration('betterReplaceOnSave');
		const replacements: ReplacementConfig[] = config.get('replacements') || [];

		const subActions = replacements.flatMap((replacement) => {
			if (replacement.id !== undefined && typeof replacement.id === 'string') {
				const subActionKind = codeActionKind.append(replacement.id);
				const subAction = new vscode.CodeAction(
					`Apply replacement: ${replacement.id}`,
					subActionKind,
				);
				subAction.command = {
					command: 'better-replace-on-save.applySpecificReplacement',
					title: 'Apply specific replacement',
					arguments: [replacement.id],
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

async function applyReplacements(editor: vscode.TextEditor, specificReplacementId?: string): Promise<void> {
	const config = vscode.workspace.getConfiguration('betterReplaceOnSave');
	const replacements: ReplacementConfig[] = config.get('replacements') || [];
	const document = editor.document;
	const languageId = document.languageId;

	// Filter replacements based on language and specific ID if provided
	let applicableReplacements = replacements;
	
	// Filter by language if needed
	if (!specificReplacementId) {
		applicableReplacements = applicableReplacements.filter(r =>
			!r.languages || r.languages.includes(languageId)
		);
	} else {
		// If a specific replacement ID was requested, only use that one and ignore language filter
		applicableReplacements = applicableReplacements.filter(r => r.id === specificReplacementId);
	}

	if (applicableReplacements.length === 0) {
		if (specificReplacementId) {
			vscode.window.showInformationMessage(`No replacement found with ID: ${specificReplacementId}`);
		}
		return;
	}

	await editor.edit((editBuilder => {
		const text = document.getText();

		for (const replacement of applicableReplacements) {
			const searchValue = new RegExp(replacement.search, 'gd');
			const results = text.matchAll(searchValue);
			for (const result of results) {
				const start = result.index;
				const end = result.index + result[0].length;
				const matchedText = text.substring(start, end);
				const replacementText = matchedText.replace(searchValue, replacement.replace);
				editBuilder.replace(new vscode.Range(document.positionAt(start), document.positionAt(end)), replacementText);
			}
		}
	}));
}

export function deactivate() { }