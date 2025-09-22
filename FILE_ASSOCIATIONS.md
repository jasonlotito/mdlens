# File Associations

mdlens supports opening markdown files directly from your file manager or by setting it as the default application for markdown files.

## Supported File Extensions

- `.md` - Markdown files
- `.markdown` - Markdown files  
- `.mdown` - Markdown files
- `.mkd` - Markdown files

## How It Works

### macOS
- Files can be opened by dragging them onto the mdlens app icon
- Right-click a markdown file → "Open With" → mdlens
- Set mdlens as default app: Right-click file → "Get Info" → "Open with" → Select mdlens → "Change All"

### Windows
- Double-click markdown files to open with mdlens (after setting as default)
- Right-click markdown file → "Open with" → mdlens
- Set as default: Right-click file → "Open with" → "Choose another app" → Select mdlens → Check "Always use this app"

### Linux
- Files can be opened via command line: `mdlens file.md`
- Desktop environments will show mdlens as an option for markdown files
- Set as default through your file manager's "Open With" settings

## Command Line Usage

You can also open files directly from the command line:

```bash
# Open single file
mdlens README.md

# Open multiple files (each in separate window)
mdlens file1.md file2.md file3.md
```

## Building with File Associations

To build mdlens with proper file associations:

```bash
npm install
npm run build
```

This will create platform-specific installers that register the file associations automatically.
