// extension.test.ts
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

import { ReplacementConfig } from '../extension';

suite('Extension Test Suite', () => {
	const workspaceFolder = path.resolve(__dirname, '..', '..', 'test-fixtures');

	suiteTeardown(async () => {
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
	});

	teardown(async () => {
		// Reset configuration after each test
		await vscode.workspace.getConfiguration('betterReplaceOnSave')
			.update('replacements', [], vscode.ConfigurationTarget.Global);
		await vscode.workspace.getConfiguration('betterReplaceOnSave')
			.update('replacementsFiles', [], vscode.ConfigurationTarget.Global);

		// Reset code actions on save
		await vscode.workspace.getConfiguration('editor').update('codeActionsOnSave', {},
			vscode.ConfigurationTarget.Global);

		// Close any open editors
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
	});

	// Helper functions to reduce duplication
	async function createTestFile(fileName: string, content: string): Promise<vscode.TextDocument> {
		const filePath = path.join(workspaceFolder, fileName);
		await fs.writeFile(filePath, content, 'utf-8');
		const doc = await vscode.workspace.openTextDocument(filePath);
		await vscode.window.showTextDocument(doc);
		return doc;
	}

	async function configureReplacements(replacements: ReplacementConfig[]): Promise<void> {
		await vscode.workspace.getConfiguration('betterReplaceOnSave')
			.update('replacements', replacements, vscode.ConfigurationTarget.Global);
	}

	async function configureReplacementFiles(files: string[]): Promise<void> {
		await vscode.workspace.getConfiguration('betterReplaceOnSave')
			.update('replacementsFiles', files, vscode.ConfigurationTarget.Global);
	}

	async function createReplacementFile(fileName: string, replacements: ReplacementConfig[]): Promise<string> {
		const filePath = path.join(workspaceFolder, fileName);
		await fs.writeFile(filePath, JSON.stringify(replacements, null, 2), 'utf-8');
		return filePath;
	}

	async function enableCodeActionsOnSave(codeActionConfig: object): Promise<void> {
		await vscode.workspace.getConfiguration('editor')
			.update('codeActionsOnSave', codeActionConfig, vscode.ConfigurationTarget.Global);
	}

	async function assertReplacement(doc: vscode.TextDocument, expected: string, message?: string): Promise<void> {
		const content = doc.getText();
		assert.strictEqual(content, expected, message);
	}

	// Test execution methods to reuse common patterns
	async function runCommandOnFile(fileName: string, initialContent: string, command: string, ...args: any[]): Promise<vscode.TextDocument> {
		const doc = await createTestFile(fileName, initialContent);
		await vscode.commands.executeCommand(command, ...args);
		return doc;
	}

	async function saveFile(fileName: string, initialContent: string): Promise<vscode.TextDocument> {
		const doc = await createTestFile(fileName, initialContent);
		await vscode.commands.executeCommand('workbench.action.files.save');
		return doc;
	}

	// Organized test groups
	suite('Basic functionality', () => {
		test('Basic replacement works', async () => {
			await configureReplacements([{
				search: 'foo',
				replace: 'bar'
			}]);

			const doc = await runCommandOnFile(
				'basic.testfile.txt',
				'This is a foo test',
				'better-replace-on-save.applyReplacements'
			);

			await assertReplacement(doc, 'This is a bar test');
		});

		test('Multiple replacements work', async () => {
			await configureReplacements([
				{
					search: 'foo',
					replace: 'bar'
				},
				{
					search: 'hello',
					replace: 'world'
				}
			]);

			const doc = await runCommandOnFile(
				'multiple.testfile.txt',
				'hello foo hello',
				'better-replace-on-save.applyReplacements'
			);

			await assertReplacement(doc, 'world bar world');
		});

		test('No changes are made when content doesn\'t match', async () => {
			await configureReplacements([{
				search: 'nonexistent',
				replace: 'replacement'
			}]);

			const doc = await runCommandOnFile(
				'nomatch.testfile.txt',
				'This content has no matches',
				'better-replace-on-save.applyReplacements'
			);

			await assertReplacement(doc, 'This content has no matches',
				'Content should remain unchanged when no matches are found');
		});

		test('Handles no active editor gracefully', async () => {
			await vscode.commands.executeCommand('workbench.action.closeAllEditors');
			await vscode.commands.executeCommand('better-replace-on-save.applyReplacements');
			// No assertions - just checking it doesn't throw
		});
	});

	suite('Language-specific functionality', () => {
		test('Language-specific replacement works', async () => {
			await configureReplacements([{
				search: 'console\\.log',
				replace: 'logger.debug',
				languages: ['typescript']
			}]);

			// Test with matching language (typescript)
			const tsDoc = await runCommandOnFile(
				'language.testfile.ts',
				'console.log("test");',
				'better-replace-on-save.applyReplacements'
			);
			await assertReplacement(tsDoc, 'logger.debug("test");');

			// Test with non-matching language (javascript)
			const jsDoc = await runCommandOnFile(
				'language.testfile.js',
				'console.log("test");',
				'better-replace-on-save.applyReplacements'
			);
			await assertReplacement(jsDoc, 'console.log("test");',
				'No replacement should occur for non-matching language');
		});
	});

	suite('Code Actions functionality', () => {
		test('Replacement takes effect on save when appropriately configured', async () => {
			await configureReplacements([{
				search: 'testText',
				replace: 'replacedText'
			}]);

			await enableCodeActionsOnSave({
				'source.applyReplacements': true
			});

			const doc = await saveFile('on-save.testfile.txt', 'This is testText that should be replaced');
			await assertReplacement(doc, 'This is replacedText that should be replaced');
		});

		test('Specific replacement command works when configured as a code action', async () => {
			await configureReplacements([{
				id: 'saveAction',
				search: 'test',
				replace: 'verified'
			}]);

			await enableCodeActionsOnSave({
				'source.applyReplacements.saveAction': true
			});

			const doc = await saveFile('save-action.testfile.txt', 'This is a test file');
			await assertReplacement(doc, 'This is a verified file');
		});
	});

	suite('ID-based replacements', () => {
		test('Specific replacement command works when called directly', async () => {
			await configureReplacements([
				{
					id: 'replacement1',
					search: 'foo',
					replace: 'bar'
				},
				{
					id: 'replacement2',
					search: 'hello',
					replace: 'world'
				}
			]);

			const doc = await runCommandOnFile(
				'specific.testfile.txt',
				'This is foo and hello text',
				'better-replace-on-save.applySpecificReplacement',
				'replacement1'
			);

			await assertReplacement(doc, 'This is bar and hello text');
		});

		test('Replacements with IDs should NOT respect language when run as a command', async () => {
			await configureReplacements([{
				id: 'pythonReplace',
				search: 'print\\(',
				replace: 'logger.info(',
				languages: ['python']
			}]);

			const jsDoc = await runCommandOnFile(
				'direct-command.testfile.js',
				'print("hello")',
				'better-replace-on-save.applySpecificReplacement',
				'pythonReplace'
			);

			await assertReplacement(jsDoc, 'logger.info("hello")',
				'Replacement should be applied despite language mismatch when run as direct command');
		});

		test('Replacements with IDs should respect language when run as a code action', async () => {
			await configureReplacements([{
				id: 'pythonReplace',
				search: 'print\\(',
				replace: 'logger.info(',
				languages: ['python']
			}]);

			await enableCodeActionsOnSave({
				'source.applyReplacements.pythonReplace': true
			});

			// Test with matching language (python)
			const pyDoc = await saveFile('language-id.testfile.py', 'print("hello")');
			await assertReplacement(pyDoc, 'logger.info("hello")',
				'Replacement should be applied on Python file');

			// Test with non-matching language (javascript)
			const jsDoc = await saveFile('language-id.testfile.js', 'print("hello")');
			await assertReplacement(jsDoc, 'print("hello")',
				'Replacement should not be applied on JavaScript file');
		});
	});

	suite('Replacements Files functionality', () => {
		test('Load replacements from external file', async () => {
			// Create a replacement file
			const replacements = [
				{
					search: 'external',
					replace: 'loaded'
				}
			];
			await createReplacementFile('test-replacements.json', replacements);
			
			// Configure to use the file
			await configureReplacementFiles(['test-replacements.json']);
			
			// Wait a moment for the configuration to take effect
			await new Promise(resolve => setTimeout(resolve, 100));

			const doc = await runCommandOnFile(
				'external.testfile.txt',
				'This is external content',
				'better-replace-on-save.applyReplacements'
			);

			await assertReplacement(doc, 'This is loaded content');
		});

		test('Merge settings and file-based replacements', async () => {
			// Configure settings-based replacement
			await configureReplacements([{
				search: 'settings',
				replace: 'config'
			}]);

			// Create file-based replacement
			const fileReplacements = [
				{
					search: 'file',
					replace: 'external'
				}
			];
			await createReplacementFile('merge-test.json', fileReplacements);
			await configureReplacementFiles(['merge-test.json']);

			// Wait for configuration to take effect
			await new Promise(resolve => setTimeout(resolve, 100));

			const doc = await runCommandOnFile(
				'merge.testfile.txt',
				'This has settings and file content',
				'better-replace-on-save.applyReplacements'
			);

			await assertReplacement(doc, 'This has config and external content');
		});

		test('Handle multiple replacement files', async () => {
			// Create first replacement file
			const replacements1 = [{ search: 'first', replace: '1st' }];
			await createReplacementFile('replacements1.json', replacements1);

			// Create second replacement file
			const replacements2 = [{ search: 'second', replace: '2nd' }];
			await createReplacementFile('replacements2.json', replacements2);

			// Configure to use both files
			await configureReplacementFiles(['replacements1.json', 'replacements2.json']);

			// Wait for configuration to take effect
			await new Promise(resolve => setTimeout(resolve, 100));

			const doc = await runCommandOnFile(
				'multiple.testfile.txt',
				'This is first and second content',
				'better-replace-on-save.applyReplacements'
			);

			await assertReplacement(doc, 'This is 1st and 2nd content');
		});

		test('Handle missing replacement file gracefully', async () => {
			// Configure to use a non-existent file
			await configureReplacementFiles(['non-existent.json']);

			// Wait for configuration to take effect
			await new Promise(resolve => setTimeout(resolve, 100));

			const doc = await runCommandOnFile(
				'missing.testfile.txt',
				'This content should not change',
				'better-replace-on-save.applyReplacements'
			);

			await assertReplacement(doc, 'This content should not change');
		});

		test('Handle invalid JSON file gracefully', async () => {
			// Create an invalid JSON file
			const invalidFilePath = path.join(workspaceFolder, 'invalid.json');
			await fs.writeFile(invalidFilePath, '{ invalid json }', 'utf-8');

			// Configure to use the invalid file
			await configureReplacementFiles(['invalid.json']);

			// Wait for configuration to take effect
			await new Promise(resolve => setTimeout(resolve, 100));

			const doc = await runCommandOnFile(
				'invalid.testfile.txt',
				'This content should not change',
				'better-replace-on-save.applyReplacements'
			);

			await assertReplacement(doc, 'This content should not change');
		});

		test('ID-based replacement from external file works', async () => {
			// Create replacement file with ID
			const replacements = [
				{
					id: 'fileReplace',
					search: 'original',
					replace: 'modified'
				}
			];
			await createReplacementFile('id-test.json', replacements);
			await configureReplacementFiles(['id-test.json']);

			// Wait for configuration to take effect
			await new Promise(resolve => setTimeout(resolve, 100));

			const doc = await runCommandOnFile(
				'id-external.testfile.txt',
				'This is original text',
				'better-replace-on-save.applySpecificReplacement',
				'fileReplace'
			);

			await assertReplacement(doc, 'This is modified text');
		});
	});
});
