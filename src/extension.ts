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
		vscode.commands.registerCommand('better-replace-on-save.applySpecificReplacements', async () => {
			// TODO: This needs to take and validate a parameter - the replacement ID. It should give the user options if possible.
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				return;
			}

			await applyReplacements(editor); // TODO: pass on parameter
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
		const action = new vscode.CodeAction(
			'Apply all configured replacements',
			codeActionKind,

		);
		mainAction.command = {
			command: 'better-replace-on-save.applyReplacements',
			title: 'Apply configured replacements'
		};
    let actions;
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
					'Apply all configured replacements',
					subActionKind,
				);
				subAction.command = {
					command: 'better-replace-on-save.applySpecificReplacement',
					title: 'Apply specific replacement',
					arguments: [replacement.id], // TODO: untested
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

async function applyReplacements(editor: vscode.TextEditor): Promise<void> {
	// TODO: Support being called for a specific replacement (or refactor out that)
	const config = vscode.workspace.getConfiguration('betterReplaceOnSave');
	const replacements: ReplacementConfig[] = config.get('replacements') || [];
	const document = editor.document;
	const languageId = document.languageId;

	// Filter replacements based on language
	const applicableReplacements = replacements.filter(r =>
		!r.languages || r.languages.includes(languageId)
	);

	if (applicableReplacements.length === 0) {
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
