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

Support for "Apply specific replacement":

- Each replacement with `"id": "subActionID"` will get an associated `source.applyReplacements.subActionID` code action subtype. This can be used eg. in the `editor.codeActionsOnSave` setting.
- There is a new command available in the command pallete: "Apply Specific Replacement"
