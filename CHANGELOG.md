# Change Log

## 0.2.1

- Added extension icon

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
