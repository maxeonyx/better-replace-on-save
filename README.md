
# Better Replace-On-Save

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

This extension adds a `source.applyReplacements` CodeActions provider which can be used in eg. the `editor.codeActionsOnSave` setting.

It adds a command `better-replace-on-save.applyReplacements ("Apply Replacements")` that can be executed from the command pallete.

Lastly, it correctly documents its settings in the `package.json` so that VSCode can provide code completion to the user.


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
    }
  ]
  // ...
}
```

<!--
## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.
-->

## Release Notes

Users appreciate release notes as you update your extension.

### 0.1.0

Initial release

---

**Enjoy!**
