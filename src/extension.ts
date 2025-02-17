// extension.ts
import * as vscode from 'vscode';

interface ReplacementConfig {
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
}

class ReplaceOnSaveCodeActionProvider implements vscode.CodeActionProvider {
	provideCodeActions(): vscode.CodeAction[] {
		const action = new vscode.CodeAction(
			'Apply configured replacements',
			vscode.CodeActionKind.Source.append('better-replace-on-save')
		);
		action.command = {
			command: 'better-replace-on-save.applyReplacements',
			title: 'Apply configured replacements'
		};
		return [action];
	}
}

async function applyReplacements(editor: vscode.TextEditor): Promise<void> {
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
			for (let result of results) {
				let start = result.index;
				let end = result.index + result[0].length;
				let matchedText = text.substring(start, end);
				let replacementText = matchedText.replace(searchValue, replacement.replace);
				editBuilder.replace(new vscode.Range(document.positionAt(start), document.positionAt(end)), replacementText);
			}
		}
	}));

}

export function deactivate() { }
