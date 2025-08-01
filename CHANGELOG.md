# Change Log
## 0.1.0

Initial release:

- "Apply Replacements" command
- "source.applyReplacements" code action
- Configuration by language.

## 0.1.1

Version bump to test publish on CI/CD

## 0.1.2

Fix codeAction name: `source.better-replace-on-save` --> `source.applyReplacements`

## 0.1.3

Fix warnings about requested code actions.

## 0.1.4

Fix extension not activating on startup.

## 0.2.0

### Added ID-based replacements and specific replacement functionality:

- **ID-based replacements**: Configure replacements with unique IDs using the `id` property
  - Each replacement with `"id": "subActionID"` gets an associated `source.applyReplacements.subActionID` code action
  - This enables fine-grained control in `editor.codeActionsOnSave` settings

- **Specific replacement command**: New command `better-replace-on-save.applySpecificReplacement` ("Apply Specific Replacement")
  - Execute from command palette to apply a single replacement by ID
  - Includes a quick pick UI to select from available replacements when no ID is provided directly

- **Context-aware language filtering**:
  - When run as code actions (on save): ID-based replacements respect language filters
  - When run as direct commands: ID-based replacements ignore language filters
  - This provides flexibility to manually apply replacements across any file type

- **Enhanced documentation**: Updated README with examples and usage instructions for the new features

## 0.3.0

### Added `replacementsFiles` option for external configuration files.

You can organize your replacements into separate files to avoid cluttering your settings.json:

- Use the `betterReplaceOnSave.replacementsFiles` setting to specify file paths
- Paths can be relative to your workspace root or absolute
- Files should contain JSON arrays of replacement objects with the same format as the `replacements` setting
- External file replacements are merged with settings-based replacements
- Files are automatically watched for changes and reloaded

## 0.3.1

Added extension icon

## 0.4.0

### Added variable expansion support for `replacementsFiles` setting

Added support for user home directory and environment variables in `betterReplaceOnSave.replacementsFiles` paths:

- **Tilde expansion**: `~/path` expands to user home directory
- **User home variable**: `${userHome}/path` expands to user home directory
- **Environment variables**: `${env:VARIABLE_NAME}/path` expands any environment variable
- **Cross-platform support**: `${env:HOME}` (Unix/Linux/Mac) and `${env:UserProfile}` (Windows)
- **Graceful handling**: Undefined environment variables are left as-is with a warning
- **Path normalization**: Prevents issues with consecutive slashes in expanded paths

**Known limitation**: File watching is not supported for files outside the workspace root. Reload the window to apply changes to these files.
