# mdlens (Markdown Lens)

A clean, keyboard-focused markdown reader/writer built with Electron.

## Features

- **Split-pane editing**: Edit markdown on the left, see live preview on the right
- **Full editor mode**: Toggle to editor-only view for distraction-free writing
- **Syntax highlighting**: Full CodeMirror support with markdown syntax highlighting
- **GitHub-style rendering**: Preview uses GitHub-flavored markdown with syntax highlighting for code blocks
- **Keyboard shortcuts**: Efficient workflow designed for keyboard-first usage
- **File operations**: Open, save, and create new markdown files
- **Clean UI**: Minimal, distraction-free interface
- **Resizable panes**: Drag the divider to adjust editor/preview split

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the application:
   ```bash
   npm start
   ```

## Keyboard Shortcuts

### File Operations
- `Ctrl/Cmd + N` - New file
- `Ctrl/Cmd + O` - Open file
- `Ctrl/Cmd + S` - Save file
- `Ctrl/Cmd + Shift + S` - Save as

### View
- `Ctrl/Cmd + \` - Toggle between split view and editor-only view
- `Shift + ?` - Show help dialog with all keyboard shortcuts

### Editor
- `Ctrl/Cmd + Z` - Undo
- `Ctrl/Cmd + Y` - Redo
- `Ctrl/Cmd + F` - Find
- `Ctrl/Cmd + G` - Find next
- `Enter` - Auto-continue markdown lists

## Development

To run in development mode:
```bash
npm run dev
```

## Building

To build the application:
```bash
npm run build
```

## Technologies Used

- **Electron** - Desktop application framework
- **CodeMirror 5** - Code editor with markdown syntax highlighting
- **Marked.js** - Markdown parser and compiler
- **Highlight.js** - Syntax highlighting for code blocks
- **GitHub CSS** - GitHub-flavored markdown styling

## License

MIT License
