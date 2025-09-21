# mdlens Sample Document

Welcome to **mdlens**, a clean markdown reader/writer built with Electron!

## Features

- ✅ **Split-pane editing**: Edit markdown on the left, see preview on the right
- ✅ **Full editor mode**: Toggle to editor-only view with `Ctrl/Cmd + \`
- ✅ **Syntax highlighting**: Full CodeMirror support with markdown syntax highlighting
- ✅ **GitHub-style rendering**: Preview uses GitHub-flavored markdown
- ✅ **Keyboard shortcuts**: Efficient workflow with keyboard-first design
- ✅ **File operations**: Open, save, and create new markdown files

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + N` | New file |
| `Ctrl/Cmd + O` | Open file |
| `Ctrl/Cmd + S` | Save file |
| `Ctrl/Cmd + Shift + S` | Save as |
| `Ctrl/Cmd + \` | Toggle view |
| `Shift + ?` | Show help |

## Code Example

Here's some sample code with syntax highlighting:

```javascript
function initializeEditor() {
    const textarea = document.getElementById('editor');
    
    editor = CodeMirror.fromTextArea(textarea, {
        mode: 'markdown',
        theme: 'github',
        lineNumbers: true,
        lineWrapping: true
    });
}
```

## Blockquote

> This is a blockquote example. It should render with proper GitHub-style formatting including the left border and indentation.

## Lists

### Unordered List
- First item
- Second item
  - Nested item
  - Another nested item
- Third item

### Ordered List
1. First step
2. Second step
3. Third step

---

**Happy writing!** 🚀
