
# Better Replace-On-Save

![Better Replace-On-Save icon](icon.png)

Replace-on-save with better VSCode integration.

This extension adds the ability to run regex replacements as a code action (it does not strictly have to be "on save")

eg.

```json
{
  // ...
  "editor.codeActionsOnSave": {
    "source.applyReplacements": true
  },
}
```

## Features

### General Features

- `source.applyReplacements` CodeActions provider which can be used in the `editor.codeActionsOnSave` setting
- Command `better-replace-on-save.applyReplacements` ("Apply Replacements") that can be executed from the command palette
- Language-specific replacements that only apply to files of specified languages
- Comprehensive settings documentation with VS Code IntelliSense support

### ID-Based Replacements (New in 0.2.0)

- Configure replacements with unique IDs to apply them individually
- Each ID-based replacement gets its own code action that can be used in `editor.codeActionsOnSave`
- Command `better-replace-on-save.applySpecificReplacement` ("Apply Specific Replacement") to run a single replacement by ID
- Context-aware language filtering:
  - ID-based replacements respect language filters when run as code actions (on save)
  - ID-based replacements ignore language filters when run as direct commands (giving you flexibility to override language constraints when needed)

## Extension Settings

Configure your replacements using the following settings:

```json
// settings.json
{
  // ...
  "betterReplaceOnSave.replacements": [
    {
      "search": "hello",
      "replace": "world"
    },
    {
      "search": "let",
      "replace": "const",
      "languages": [ "typescript", "javascript" ] // Optional
    },
    {
      "id": "convertPrint", // Optional: enables specific replacement functionality
      "search": "print\\(",
      "replace": "logger.info(",
      "languages": [ "python" ] // Optional
    }
  ],
  "betterReplaceOnSave.replacementsFiles": [
    // Optional: Load additional replacements from external files
    "betterReplaceOnSave.json",
    "configs/python-replacements.json",
    // Variables are supported for user home directory:
    "~/dotfiles/vscode/betterReplaceOnSave.json",
    "${userHome}/.config/vscode/betterReplaceOnSave.json",
    "${env:HOME}/.dotfiles/vscode/betterReplaceOnSave.json",
    "${env:UserProfile}/.dotfiles/vscode/betterReplaceOnSave.json"
  ]
  // ...
}
```

### External Replacement Files (New in 0.3.0)

You can organize your replacements into separate files to avoid cluttering your settings.json:

- Use the `betterReplaceOnSave.replacementsFiles` setting to specify file paths
- Paths can be relative to your workspace root, absolute, or use variables for user home directory
- **Variable support (New in 0.4.0)**: Use `~/path`, `${userHome}/path`, `${env:HOME}/path`, `${env:UserProfile}/path`, or `${env:VARIABLE_NAME}/path`
- Files should contain JSON arrays of replacement objects with the same format as the `replacements` setting
- External file replacements are merged with settings-based replacements
- Files are automatically watched for changes and reloaded

**Example paths with variables:**
```json
{
  "betterReplaceOnSave.replacementsFiles": [
    "betterReplaceOnSave.json",  // Workspace relative
    "~/dotfiles/vscode/betterReplaceOnSave.json",  // User home with tilde
    "${userHome}/.config/vscode/betterReplaceOnSave.json",  // User home variable
    "${env:HOME}/.dotfiles/vscode/betterReplaceOnSave.json",  // HOME environment variable (Unix/Linux/Mac)
    "${env:UserProfile}/.dotfiles/vscode/betterReplaceOnSave.json"  // UserProfile environment variable (Windows)
  ]
}
```

**Example replacement file (`betterReplaceOnSave.json`):**
```json
[
  {
    "id": "consoleToLogger",
    "search": "console\\.log\\(",
    "replace": "logger.info(",
    "languages": ["javascript", "typescript"]
  },
  {
    "search": "TODO:",
    "replace": "FIXME:"
  }
]
```

### Applying Specific Replacements on Save

You can configure VS Code to run only specific replacements on save:

```json
{
  "editor.codeActionsOnSave": {
    // Apply a specific replacement with ID "convertPrint"
    "source.applyReplacements.convertPrint": true
  }
}
```

### Applying Specific Replacements Manually

To apply a specific replacement manually:

1. Open the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac)
2. Search for "Apply Specific Replacement"
3. Select the replacement by ID from the dropdown

This is particularly useful when you want to apply a replacement regardless of language restrictions.

<!--
## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.
-->

## Release Notes

Users appreciate release notes as you update your extension.

### 0.1.0

Initial release

### 0.2.0

Support for specific replacement code actions, and "Apply specific replacement" command.

### 0.3.0

Support for external replacement files via `betterReplaceOnSave.replacementsFiles` configuration option.

### 0.4.0

Support for user home directory variables in `betterReplaceOnSave.replacementsFiles`. You can now use `~/path`, `${userHome}/path`, `${env:HOME}/path`, `${env:UserProfile}/path`, or `${env:VARIABLE_NAME}/path` in file paths.

NOTE: *File watch is not supported for files outside the workspace root. Reload the window to apply changes to these files.*

---

**Enjoy!**
