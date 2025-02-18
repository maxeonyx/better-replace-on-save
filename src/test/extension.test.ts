// extension.test.ts
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';


suite('Extension Test Suite', () => {
	const workspaceFolder = path.resolve(__dirname, '..', '..', 'test-fixtures');

	suiteTeardown(async () => {
		// Close any open editors
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
	});

	teardown(async () => {
		// Reset configuration after each test
		await vscode.workspace.getConfiguration('betterReplaceOnSave')
			.update('replacements', [], vscode.ConfigurationTarget.Global);

		// Close any open editors
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
	});

	async function createTestFile(fileName: string, content: string): Promise<vscode.TextDocument> {
		const filePath = path.join(workspaceFolder, fileName);
		await fs.writeFile(filePath, content, 'utf-8');
		const doc = await vscode.workspace.openTextDocument(filePath);
		await vscode.window.showTextDocument(doc);
		return doc;
	}

	test('Basic replacement works', async () => {
		// Setup test configuration
		await vscode.workspace.getConfiguration('betterReplaceOnSave').update('replacements', [
			{
				search: 'foo',
				replace: 'bar'
			}
		], vscode.ConfigurationTarget.Global);

		// Create and open test file
		const doc = await createTestFile('basic.testfile.txt', 'This is a foo test');

		// Execute the command
		await vscode.commands.executeCommand('better-replace-on-save.applyReplacements');

		// Verify the content was updated
		const updatedContent = doc.getText();
		assert.strictEqual(updatedContent, 'This is a bar test');
	});

	test('Language-specific replacement works', async () => {
		// Setup test configuration with language-specific replacements
		await vscode.workspace.getConfiguration('betterReplaceOnSave').update('replacements', [
			{
				search: 'console\\.log',
				replace: 'logger.debug',
				languages: ['typescript']
			}
		], vscode.ConfigurationTarget.Global);

		// Test with matching language (typescript)
		const tsDoc = await createTestFile('language.testfile.ts', 'console.log("test");');
		await vscode.commands.executeCommand('better-replace-on-save.applyReplacements');
		assert.strictEqual(tsDoc.getText(), 'logger.debug("test");');

		// Test with non-matching language (javascript)
		const jsDoc = await createTestFile('language.testfile.js', 'console.log("test");');
		await vscode.commands.executeCommand('better-replace-on-save.applyReplacements');
		assert.strictEqual(jsDoc.getText(), 'console.log("test");',
			'No replacement should occur for non-matching language');
	});

	test('Multiple replacements work', async () => {
		await vscode.workspace.getConfiguration('betterReplaceOnSave').update('replacements', [
			{
				search: 'foo',
				replace: 'bar'
			},
			{
				search: 'hello',
				replace: 'world'
			}
		], vscode.ConfigurationTarget.Global);

		const doc = await createTestFile('multiple.testfile.txt', 'hello foo hello');
		await vscode.commands.executeCommand('better-replace-on-save.applyReplacements');

		assert.strictEqual(doc.getText(), 'world bar world');
	});

	test('No changes are made when content doesn\'t match', async () => {
		await vscode.workspace.getConfiguration('betterReplaceOnSave').update('replacements', [
			{
				search: 'nonexistent',
				replace: 'replacement'
			}
		], vscode.ConfigurationTarget.Global);

		const doc = await createTestFile('nomatch.testfile.txt', 'This content has no matches');
		const originalContent = doc.getText();

		await vscode.commands.executeCommand('better-replace-on-save.applyReplacements');

		assert.strictEqual(doc.getText(), originalContent,
			'Content should remain unchanged when no matches are found');
	});

	test('Handles no active editor gracefully', async () => {
		// Close any open editors
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');

		// This should not throw an error
		await vscode.commands.executeCommand('better-replace-on-save.applyReplacements');

		// No assertions needed - we're just checking that it doesn't throw
	});

	test('Replacement takes effect on save when appropriately configured', async () => {
		// 1. Configure the replacements
		await vscode.workspace.getConfiguration('betterReplaceOnSave').update('replacements', [
			{
				search: 'testText',
				replace: 'replacedText'
			}
		], vscode.ConfigurationTarget.Global);

		// 2. Configure codeActionsOnSave to include our command
		await vscode.workspace.getConfiguration('editor').update('codeActionsOnSave', {
			'source.applyReplacements': true
		}, vscode.ConfigurationTarget.Global);

		// 3. Create and open test file
		const doc = await createTestFile('on-save.testfile.txt', 'This is testText that should be replaced');

		// 4. Save the document - this should trigger our code action
		await vscode.commands.executeCommand('workbench.action.files.save');

		// 5. Verify the content was updated
		const updatedContent = doc.getText();
		assert.strictEqual(updatedContent, 'This is replacedText that should be replaced');

		// 6. Clean up the codeActionsOnSave configuration
		await vscode.workspace.getConfiguration('editor').update('codeActionsOnSave', {},
			vscode.ConfigurationTarget.Global);
	});

	test("Specific replacement command works when called directly", async () => {

		// TODO directly call better-replace-on-save.applySpecificReplacement

	});

	test("Specific replacement command works when configured as a code action", async () => {

		// TODO test "on save" replace. Set up editor.codeActionsOnSave with a sub-action source.applyReplacements.replacementID

	});

});
