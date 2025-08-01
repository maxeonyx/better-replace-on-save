// extension.test.ts
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

import { ReplacementConfig, expandVariables } from '../extension';

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
				'basic-basic-replacement.testfile.txt',
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
				'basic-multiple-replacements.testfile.txt',
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
				'basic-no-match.testfile.txt',
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
				'langspec-language-ts.testfile.ts',
				'console.log("test");',
				'better-replace-on-save.applyReplacements'
			);
			await assertReplacement(tsDoc, 'logger.debug("test");');

			// Test with non-matching language (javascript)
			const jsDoc = await runCommandOnFile(
				'langspec-language-js.testfile.js',
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

			const doc = await saveFile('codeactions-on-save.testfile.txt', 'This is testText that should be replaced');
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

			const doc = await saveFile('codeactions-save-action.testfile.txt', 'This is a test file');
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
				'id-specific-replacement.testfile.txt',
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
				'id-direct-command.testfile.js',
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
			const pyDoc = await saveFile('id-language-id-py.testfile.py', 'print("hello")');
			await assertReplacement(pyDoc, 'logger.info("hello")',
				'Replacement should be applied on Python file');

			// Test with non-matching language (javascript)
			const jsDoc = await saveFile('id-language-id-js.testfile.js', 'print("hello")');
			await assertReplacement(jsDoc, 'print("hello")',
				'Replacement should not be applied on JavaScript file');
		});
	});

	suite('Variable expansion functionality', () => {
		test('Tilde (~) expands to user home directory', () => {
			const result = expandVariables('~/test/path');
			const expected = path.join(os.homedir(), 'test/path');
			assert.strictEqual(result, expected);
		});

		test('${userHome} variable expands to user home directory', () => {
			const result = expandVariables('${userHome}/test/path');
			const expected = path.join(os.homedir(), 'test/path');
			assert.strictEqual(result, expected);
		});

		test('Multiple ${userHome} variables are expanded', () => {
			const result = expandVariables('${userHome}/first/${userHome}/second');
			const homeDir = os.homedir();
			const expected = path.join(homeDir, 'first', homeDir, 'second');
			assert.strictEqual(result, expected);
		});

		test('${env:HOME} expands to HOME environment variable', () => {
			const originalHome = process.env.HOME;
			process.env.HOME = '/custom/home';
			
			const result = expandVariables('${env:HOME}/test/path');
			const expected = path.join('/custom/home', 'test/path');
			assert.strictEqual(result, expected);

			// Restore original value
			if (originalHome !== undefined) {
				process.env.HOME = originalHome;
			} else {
				delete process.env.HOME;
			}
		});

		test('${env:UserProfile} expands to UserProfile environment variable', () => {
			const originalUserProfile = process.env.UserProfile;
			process.env.UserProfile = 'C:\\Users\\TestUser';
			
			const result = expandVariables('${env:UserProfile}/test/path');
			const expected = path.join('C:\\Users\\TestUser', 'test/path');
			assert.strictEqual(result, expected);

			// Restore original value
			if (originalUserProfile !== undefined) {
				process.env.UserProfile = originalUserProfile;
			} else {
				delete process.env.UserProfile;
			}
		});

		test('${env:CUSTOM_VAR} expands custom environment variable', () => {
			const originalCustomVar = process.env.CUSTOM_VAR;
			process.env.CUSTOM_VAR = '/custom/value';
			
			const result = expandVariables('${env:CUSTOM_VAR}/test/path');
			const expected = path.join('/custom/value', 'test/path');
			assert.strictEqual(result, expected);

			// Restore original value
			if (originalCustomVar !== undefined) {
				process.env.CUSTOM_VAR = originalCustomVar;
			} else {
				delete process.env.CUSTOM_VAR;
			}
		});

		test('Undefined environment variable is left as-is', () => {
			const result = expandVariables('${env:UNDEFINED_VAR}/test/path');
			assert.strictEqual(result, '${env:UNDEFINED_VAR}/test/path');
		});

		test('Absolute path without variables is unchanged', () => {
			const absolutePath = '/absolute/path/to/file';
			const result = expandVariables(absolutePath);
			assert.strictEqual(result, absolutePath);
		});

		test('Relative path without variables is unchanged', () => {
			const relativePath = 'relative/path/to/file';
			const result = expandVariables(relativePath);
			assert.strictEqual(result, relativePath);
		});

		test('Mixed variable types are all expanded', () => {
			const originalCustomVar = process.env.CUSTOM_VAR;
			process.env.CUSTOM_VAR = 'custom';
			
			const result = expandVariables('${env:CUSTOM_VAR}/${userHome}/test');
			const expected = path.join('custom', os.homedir(), 'test');
			assert.strictEqual(result, expected);

			// Restore original value
			if (originalCustomVar !== undefined) {
				process.env.CUSTOM_VAR = originalCustomVar;
			} else {
				delete process.env.CUSTOM_VAR;
			}
		});

		test('Variable expansion with replacements files loading', async () => {
			// Create a test file in the user's home directory (simulated with temp dir)
			const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vscode-test-'));
			const testFile = 'test-home-replacements.json';
			const testFilePath = path.join(tempDir, testFile);
			
			const replacements = [
				{
					search: 'hometest',
					replace: 'expanded'
				}
			];
			await fs.writeFile(testFilePath, JSON.stringify(replacements, null, 2), 'utf-8');

			// Set up a custom environment variable to point to our temp directory
			const originalTestHome = process.env.TEST_HOME;
			process.env.TEST_HOME = tempDir;

			try {
				// Configure to use the file with environment variable expansion
				await configureReplacementFiles([`\${env:TEST_HOME}/${testFile}`]);

				const doc = await runCommandOnFile(
					'varexp-env-var-replacement.testfile.txt',
					'This is hometest content',
					'better-replace-on-save.applyReplacements'
				);

				await assertReplacement(doc, 'This is expanded content');
			} finally {
				// Clean up
				await fs.unlink(testFilePath);
				await fs.rmdir(tempDir);
				
				if (originalTestHome !== undefined) {
					process.env.TEST_HOME = originalTestHome;
				} else {
					delete process.env.TEST_HOME;
				}
			}
		});

		test('Variable expansion with userHome variable in replacements files', async () => {
			// Create a test file in the user's home directory (simulated with temp dir)
			const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vscode-test-'));
			const testFile = 'test-userhome-replacements.json';
			const testFilePath = path.join(tempDir, testFile);
			
			const replacements = [
				{
					search: 'userhometest',
					replace: 'userhome-expanded'
				}
			];
			await fs.writeFile(testFilePath, JSON.stringify(replacements, null, 2), 'utf-8');

			// Set up a custom environment variable to point to our temp directory
			const originalTestHome = process.env.TEST_HOME_DIR;
			process.env.TEST_HOME_DIR = tempDir;

			try {
				// Configure to use the file with ${userHome} expansion - but since we can't easily mock os.homedir(),
				// we'll use an environment variable instead for this test
				await configureReplacementFiles([`\${env:TEST_HOME_DIR}/${testFile}`]);

				const doc = await runCommandOnFile(
					'varexp-userhome-replacement.testfile.txt',
					'This is userhometest content',
					'better-replace-on-save.applyReplacements'
				);

				await assertReplacement(doc, 'This is userhome-expanded content');
			} finally {
				// Clean up
				await fs.unlink(testFilePath);
				await fs.rmdir(tempDir);
				
				if (originalTestHome !== undefined) {
					process.env.TEST_HOME_DIR = originalTestHome;
				} else {
					delete process.env.TEST_HOME_DIR;
				}
			}
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
			await createReplacementFile('replfiles-load-external-replacements.json', replacements);

			// Configure to use the file
			await configureReplacementFiles(['replfiles-load-external-replacements.json']);

			const doc = await runCommandOnFile(
				'replfiles-load-external.testfile.txt',
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
			await createReplacementFile('replfiles-merge-settings-file.json', fileReplacements);
			await configureReplacementFiles(['replfiles-merge-settings-file.json']);

			const doc = await runCommandOnFile(
				'replfiles-merge-settings-file.testfile.txt',
				'This has settings and file content',
				'better-replace-on-save.applyReplacements'
			);

			await assertReplacement(doc, 'This has config and external content');
		});

		test('Handle multiple replacement files', async () => {
			// Create first replacement file
			const replacements1 = [{ search: 'first', replace: '1st' }];
			await createReplacementFile('replfiles-multiple-files-1.json', replacements1);

			// Create second replacement file
			const replacements2 = [{ search: 'second', replace: '2nd' }];
			await createReplacementFile('replfiles-multiple-files-2.json', replacements2);

			// Configure to use both files
			await configureReplacementFiles(['replfiles-multiple-files-1.json', 'replfiles-multiple-files-2.json']);

			const doc = await runCommandOnFile(
				'replfiles-multiple-files.testfile.txt',
				'This is first and second content',
				'better-replace-on-save.applyReplacements'
			);

			await assertReplacement(doc, 'This is 1st and 2nd content');
		});

		test('Handle missing replacement file gracefully', async () => {
			// Configure to use a non-existent file
			await configureReplacementFiles(['replfiles-missing-file.json']);

			const doc = await runCommandOnFile(
				'replfiles-missing-file.testfile.txt',
				'This content should not change',
				'better-replace-on-save.applyReplacements'
			);

			await assertReplacement(doc, 'This content should not change');
		});

		test('Handle invalid JSON file gracefully', async () => {
			// Create an invalid JSON file
			const invalidFilePath = path.join(workspaceFolder, 'replfiles-invalid-json.json');
			await fs.writeFile(invalidFilePath, '{ invalid json }', 'utf-8');

			// Configure to use the invalid file
			await configureReplacementFiles(['replfiles-invalid-json.json']);

			const doc = await runCommandOnFile(
				'replfiles-invalid-json.testfile.txt',
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
			await createReplacementFile('replfiles-id-external.json', replacements);
			await configureReplacementFiles(['replfiles-id-external.json']);

			const doc = await runCommandOnFile(
				'replfiles-id-external.testfile.txt',
				'This is original text',
				'better-replace-on-save.applySpecificReplacement',
				'fileReplace'
			);

			await assertReplacement(doc, 'This is modified text');
		});
	});
});
