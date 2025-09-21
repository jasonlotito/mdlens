// Application state
let editor;
let currentContent = '';
let isEditorOnly = false;
let isResizing = false;
let isVimMode = true;
let vimrcConfig = {};

// Load and apply .vimrc configuration
async function loadVimrcConfig() {
    try {
        const result = await window.electronAPI.loadVimrc();
        if (result.success) {
            vimrcConfig = result.config;
            console.log('Loaded .vimrc configuration:', vimrcConfig);
            return vimrcConfig;
        }
    } catch (error) {
        console.warn('Could not load .vimrc:', error);
    }
    return {};
}

// Apply .vimrc settings to CodeMirror
function applyVimrcSettings() {
    if (!vimrcConfig.settings) return;

    const settings = vimrcConfig.settings;

    // Apply common Vim settings that have CodeMirror equivalents
    if (settings.number !== undefined) {
        editor.setOption('lineNumbers', settings.number);
    }

    if (settings.wrap !== undefined) {
        editor.setOption('lineWrapping', settings.wrap);
    }

    if (settings.tabstop !== undefined) {
        const tabSize = parseInt(settings.tabstop);
        if (!isNaN(tabSize)) {
            editor.setOption('tabSize', tabSize);
            editor.setOption('indentUnit', tabSize);
        }
    }

    if (settings.expandtab !== undefined) {
        editor.setOption('indentWithTabs', !settings.expandtab);
    }

    if (settings.autoindent !== undefined) {
        editor.setOption('smartIndent', settings.autoindent);
    }

    // Apply custom key mappings if in Vim mode
    if (isVimMode && vimrcConfig.mappings) {
        applyVimMappings();
    }
}

// Apply Vim key mappings
function applyVimMappings() {
    const mappings = vimrcConfig.mappings;

    // Apply normal mode mappings
    if (mappings.nnoremap || mappings.nmap) {
        const normalMaps = { ...mappings.nmap, ...mappings.nnoremap };
        for (const [from, to] of Object.entries(normalMaps)) {
            try {
                // Convert vim key notation to CodeMirror format
                const cmFrom = convertVimKeyToCodeMirror(from);
                const cmTo = convertVimCommandToCodeMirror(to);

                if (cmFrom && cmTo) {
                    CodeMirror.Vim.map(cmFrom, cmTo, 'normal');
                }
            } catch (error) {
                console.warn(`Could not apply mapping ${from} -> ${to}:`, error);
            }
        }
    }

    // Apply insert mode mappings
    if (mappings.inoremap || mappings.imap) {
        const insertMaps = { ...mappings.imap, ...mappings.inoremap };
        for (const [from, to] of Object.entries(insertMaps)) {
            try {
                const cmFrom = convertVimKeyToCodeMirror(from);
                const cmTo = convertVimCommandToCodeMirror(to);

                if (cmFrom && cmTo) {
                    CodeMirror.Vim.map(cmFrom, cmTo, 'insert');
                }
            } catch (error) {
                console.warn(`Could not apply insert mapping ${from} -> ${to}:`, error);
            }
        }
    }
}

// Convert Vim key notation to CodeMirror format
function convertVimKeyToCodeMirror(vimKey) {
    // Handle common Vim key notations
    return vimKey
        .replace(/<CR>/g, '<Enter>')
        .replace(/<Esc>/g, '<Esc>')
        .replace(/<Space>/g, '<Space>')
        .replace(/<Tab>/g, '<Tab>')
        .replace(/<C-([a-zA-Z])>/g, '<Ctrl-$1>')
        .replace(/<M-([a-zA-Z])>/g, '<Alt-$1>')
        .replace(/<S-([a-zA-Z])>/g, '<Shift-$1>');
}

// Convert Vim command to CodeMirror format
function convertVimCommandToCodeMirror(vimCommand) {
    // For now, return as-is since most Vim commands work directly
    // This could be expanded to handle more complex conversions
    return vimCommand;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    // Detect platform and add class to body
    if (navigator.platform.toLowerCase().includes('mac')) {
        document.body.classList.add('platform-darwin');
    }

    // Load .vimrc configuration first
    await loadVimrcConfig();

    // Wait a bit for external libraries to load
    setTimeout(() => {
        initializeEditor();
        initializePreview();
        initializeResizer();
        initializeEventListeners();
        initializeKeyboardShortcuts();

        // Apply .vimrc settings after editor is initialized
        applyVimrcSettings();

        // Set initial content
        updatePreview();
    }, 100);
});

// Initialize CodeMirror editor
function initializeEditor() {
    const textarea = document.getElementById('editor');

    editor = CodeMirror.fromTextArea(textarea, {
        mode: 'markdown',
        theme: 'github',
        lineNumbers: true,
        lineWrapping: true,
        autoCloseBrackets: true,
        matchBrackets: true,
        keyMap: 'vim',
        extraKeys: {
            'Enter': 'newlineAndIndentContinueMarkdownList',
            'Ctrl-F': 'findPersistent',
            'Cmd-F': 'findPersistent',
            'Ctrl-G': 'findNext',
            'Cmd-G': 'findNext',
            'Shift-Ctrl-G': 'findPrev',
            'Shift-Cmd-G': 'findPrev'
        },
        placeholder: 'Start typing your markdown here...'
    });

    // Update preview on content change
    editor.on('change', () => {
        currentContent = editor.getValue();
        updatePreview();
    });

    // Handle Vim mode changes
    editor.on('vim-mode-change', (modeObj) => {
        updateVimStatus(modeObj);
    });

    // Handle Vim key display
    editor.on('vim-keypress', (key) => {
        updateVimKeys(key);
    });

    // Initialize vim status
    updateVimStatus({ mode: 'normal' });

    // Focus the editor
    editor.focus();
}

// Initialize markdown preview
function initializePreview() {
    // Configure marked for GitHub-style markdown
    if (typeof marked !== 'undefined' && marked.setOptions) {
        marked.setOptions({
            highlight: function(code, lang) {
                if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(code, { language: lang }).value;
                    } catch (err) {
                        console.error('Highlight.js error:', err);
                    }
                }
                if (typeof hljs !== 'undefined') {
                    return hljs.highlightAuto(code).value;
                }
                return code;
            },
            breaks: true,
            gfm: true
        });
    }
}

// Update the preview content
function updatePreview() {
    const previewContent = document.getElementById('preview-content');
    const content = currentContent || '# Welcome to mdlens\n\nStart typing to see your markdown rendered here.';

    try {
        // Check if marked is available
        if (typeof marked === 'undefined') {
            previewContent.innerHTML = '<p>Loading markdown parser...</p>';
            return;
        }

        // Use marked to parse the content
        let html;
        if (typeof marked === 'function') {
            html = marked(content);
        } else if (marked.parse) {
            html = marked.parse(content);
        } else {
            throw new Error('Marked library not properly loaded');
        }

        previewContent.innerHTML = html;
    } catch (error) {
        console.error('Markdown parsing error:', error);
        previewContent.innerHTML = '<p>Error parsing markdown: ' + error.message + '</p>';
    }
}

// Initialize the resizer functionality
function initializeResizer() {
    const resizer = document.getElementById('resizer');
    const editorPanel = document.getElementById('editor-panel');
    const previewPanel = document.getElementById('preview-panel');
    const container = document.getElementById('container');

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        resizer.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const startX = e.clientX;
        const startEditorWidth = editorPanel.offsetWidth;
        const containerWidth = container.offsetWidth;

        function handleMouseMove(e) {
            if (!isResizing) return;

            const deltaX = e.clientX - startX;
            const newEditorWidth = startEditorWidth + deltaX;
            const minWidth = 300;
            const maxWidth = containerWidth - minWidth - 4; // 4px for resizer

            if (newEditorWidth >= minWidth && newEditorWidth <= maxWidth) {
                const editorPercent = (newEditorWidth / containerWidth) * 100;
                const previewPercent = 100 - editorPercent;

                editorPanel.style.width = `${editorPercent}%`;
                previewPanel.style.width = `${previewPercent}%`;
            }
        }

        function handleMouseUp() {
            isResizing = false;
            resizer.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        }

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    });
}

// Initialize event listeners for IPC communication
function initializeEventListeners() {
    // New file
    window.electronAPI.onNewFile(() => {
        editor.setValue('');
        currentContent = '';
        updatePreview();
    });

    // File opened
    window.electronAPI.onFileOpened((event, data) => {
        editor.setValue(data.content);
        currentContent = data.content;
        updatePreview();
    });

    // Save file
    window.electronAPI.onSaveFile(async () => {
        const result = await window.electronAPI.saveFile(currentContent);
        if (!result.success) {
            console.error('Save failed:', result.error);
        }
    });

    // Save file as
    window.electronAPI.onSaveFileAs(async (event, filePath) => {
        const result = await window.electronAPI.saveFileAs(currentContent, filePath);
        if (!result.success) {
            console.error('Save as failed:', result.error);
        }
    });

    // Toggle view
    window.electronAPI.onToggleView(() => {
        toggleView();
    });

    // Toggle Vim mode
    window.electronAPI.onToggleVim(() => {
        toggleVimMode();
    });

    // Reload .vimrc
    window.electronAPI.onReloadVimrc(async () => {
        await loadVimrcConfig();
        if (isVimMode) {
            applyVimrcSettings();
        }
        console.log('Reloaded .vimrc configuration');
    });

    // Show help
    window.electronAPI.onShowHelp(() => {
        showHelpModal();
    });

    // Update title
    window.electronAPI.onUpdateTitle((event, title) => {
        const titleElement = document.querySelector('.title-text');
        if (titleElement) {
            titleElement.textContent = title;
        }
    });
}

// Initialize keyboard shortcuts
function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Shift + ? for help
        if (e.shiftKey && e.key === '?') {
            e.preventDefault();
            showHelpModal();
        }
        
        // Escape to close modal
        if (e.key === 'Escape') {
            hideHelpModal();
        }
    });

    // Help modal close button
    document.getElementById('close-help').addEventListener('click', hideHelpModal);
    
    // Click outside modal to close
    document.getElementById('help-modal').addEventListener('click', (e) => {
        if (e.target.id === 'help-modal') {
            hideHelpModal();
        }
    });
}

// Toggle between split view and editor-only view
function toggleView() {
    const container = document.getElementById('container');
    isEditorOnly = !isEditorOnly;

    if (isEditorOnly) {
        container.classList.remove('split-view');
        container.classList.add('editor-only');
    } else {
        container.classList.remove('editor-only');
        container.classList.add('split-view');
    }

    // Refresh editor to handle layout changes
    setTimeout(() => {
        editor.refresh();
    }, 100);
}

// Toggle Vim mode
function toggleVimMode() {
    isVimMode = !isVimMode;

    if (isVimMode) {
        editor.setOption('keyMap', 'vim');
        document.getElementById('vim-status').style.display = 'flex';
        updateVimStatus({ mode: 'normal' });

        // Reapply .vimrc settings when enabling Vim mode
        applyVimrcSettings();
    } else {
        editor.setOption('keyMap', 'default');
        document.getElementById('vim-status').style.display = 'none';
    }

    // Refresh editor to handle layout changes
    setTimeout(() => {
        editor.refresh();
    }, 100);
}

// Show help modal
function showHelpModal() {
    document.getElementById('help-modal').classList.remove('hidden');
}

// Hide help modal
function hideHelpModal() {
    document.getElementById('help-modal').classList.add('hidden');
}

// Update Vim status line
function updateVimStatus(modeObj) {
    const vimModeElement = document.getElementById('vim-mode');
    if (vimModeElement && modeObj) {
        const mode = modeObj.mode || 'normal';
        const subMode = modeObj.subMode || '';

        let modeText = mode.toUpperCase();
        if (subMode) {
            modeText += ` (${subMode})`;
        }

        vimModeElement.textContent = modeText;

        // Update status bar color based on mode
        const statusBar = document.getElementById('vim-status');
        if (statusBar) {
            statusBar.className = 'vim-status vim-mode-' + mode;
        }
    }
}

// Update Vim key display
function updateVimKeys(key) {
    const vimKeysElement = document.getElementById('vim-keys');
    if (vimKeysElement) {
        vimKeysElement.textContent = key || '';
    }
}

// Handle file drag and drop
document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

document.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
        const file = files[0];
        const reader = new FileReader();

        reader.onload = (event) => {
            editor.setValue(event.target.result);
            currentContent = event.target.result;
            updatePreview();
        };

        reader.readAsText(file);
    }
});

// Handle window resize
window.addEventListener('resize', () => {
    setTimeout(() => {
        editor.refresh();
    }, 100);
});
