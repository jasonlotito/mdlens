const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const os = require('os');

let windows = new Map(); // Store window instances and their file paths
let windowCounter = 0;

// Function to read and parse .vimrc file
async function readVimrc() {
  const homeDir = os.homedir();
  const vimrcPaths = [
    path.join(homeDir, '.vimrc'),
    path.join(homeDir, '.vim', 'vimrc'),
    path.join(homeDir, '_vimrc') // Windows
  ];

  for (const vimrcPath of vimrcPaths) {
    try {
      const content = await fs.readFile(vimrcPath, 'utf8');
      return parseVimrc(content);
    } catch (error) {
      // File doesn't exist or can't be read, try next path
      continue;
    }
  }

  return {}; // Return empty config if no .vimrc found
}

// Function to parse .vimrc content and extract relevant settings
function parseVimrc(content) {
  const config = {
    settings: {},
    mappings: {},
    commands: []
  };

  const lines = content.split('\n');

  for (let line of lines) {
    line = line.trim();

    // Skip comments and empty lines
    if (line.startsWith('"') || line.startsWith('#') || !line) {
      continue;
    }

    // Parse set commands
    if (line.startsWith('set ')) {
      const setting = line.substring(4).trim();
      if (setting.includes('=')) {
        const [key, value] = setting.split('=', 2);
        config.settings[key.trim()] = value.trim();
      } else {
        // Boolean settings
        if (setting.startsWith('no')) {
          config.settings[setting.substring(2)] = false;
        } else {
          config.settings[setting] = true;
        }
      }
    }

    // Parse key mappings
    else if (line.match(/^(map|nmap|imap|vmap|nnoremap|inoremap|vnoremap)\s+/)) {
      const parts = line.split(/\s+/);
      if (parts.length >= 3) {
        const mapType = parts[0];
        const from = parts[1];
        const to = parts.slice(2).join(' ');

        if (!config.mappings[mapType]) {
          config.mappings[mapType] = {};
        }
        config.mappings[mapType][from] = to;
      }
    }

    // Store other commands for potential future use
    else {
      config.commands.push(line);
    }
  }

  return config;
}

function createWindow(filePath = null) {
  const windowId = ++windowCounter;

  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false
  });

  // Store window with its associated data
  windows.set(windowId, {
    window: window,
    filePath: filePath,
    id: windowId
  });

  window.loadFile(path.join(__dirname, 'index.html'));

  window.once('ready-to-show', () => {
    window.show();

    // If a file path was provided, open it
    if (filePath) {
      openFileInWindow(windowId, filePath);
    }
  });

  window.on('closed', () => {
    windows.delete(windowId);
  });

  // Set up the menu (will be shared across all windows)
  createMenu();

  return windowId;
}

// Helper function to get the currently focused window data
function getActiveWindowData() {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (!focusedWindow) return null;

  for (const [id, data] of windows.entries()) {
    if (data.window === focusedWindow) {
      return data;
    }
  }
  return null;
}

// Helper function to open a file in a specific window
async function openFileInWindow(windowId, filePath) {
  const windowData = windows.get(windowId);
  if (!windowData) return;

  try {
    const content = await fs.readFile(filePath, 'utf8');
    windowData.filePath = filePath;
    windowData.window.webContents.send('file-opened', { content, filePath });
    updateWindowTitle(windowId);
  } catch (error) {
    dialog.showErrorBox('Error', `Could not open file: ${error.message}`);
  }
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New',
          accelerator: 'CmdOrCtrl+N',
          click: () => newFile()
        },
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => createWindow()
        },
        {
          label: 'Open',
          accelerator: 'CmdOrCtrl+O',
          click: () => openFile()
        },
        {
          label: 'Open in New Window',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => openFileInNewWindow()
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => saveFile()
        },
        {
          label: 'Save As',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => saveFileAs()
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Editor/Preview',
          accelerator: 'CmdOrCtrl+\\',
          click: () => {
            const activeWindow = getActiveWindowData();
            if (activeWindow) activeWindow.window.webContents.send('toggle-view');
          }
        },
        {
          label: 'Toggle Vim Mode',
          accelerator: 'CmdOrCtrl+Shift+V',
          click: () => {
            const activeWindow = getActiveWindowData();
            if (activeWindow) activeWindow.window.webContents.send('toggle-vim');
          }
        },
        {
          label: 'Reload .vimrc',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            const activeWindow = getActiveWindowData();
            if (activeWindow) activeWindow.window.webContents.send('reload-vimrc');
          }
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
          click: () => {
            const activeWindow = getActiveWindowData();
            if (activeWindow) activeWindow.window.webContents.toggleDevTools();
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'Shift+?',
          click: () => {
            const activeWindow = getActiveWindowData();
            if (activeWindow) activeWindow.window.webContents.send('show-help');
          }
        }
      ]
    }
  ];

  // macOS specific menu adjustments
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function newFile() {
  const activeWindow = getActiveWindowData();
  if (!activeWindow) return;

  activeWindow.filePath = null;
  activeWindow.window.webContents.send('new-file');
  updateWindowTitle(activeWindow.id);
}

async function openFile() {
  const activeWindow = getActiveWindowData();
  if (!activeWindow) return;

  const result = await dialog.showOpenDialog(activeWindow.window, {
    properties: ['openFile'],
    filters: [
      { name: 'Markdown Files', extensions: ['md', 'markdown', 'mdown', 'mkd'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    await openFileInWindow(activeWindow.id, filePath);
  }
}

async function openFileInNewWindow() {
  const result = await dialog.showOpenDialog(null, {
    properties: ['openFile'],
    filters: [
      { name: 'Markdown Files', extensions: ['md', 'markdown', 'mdown', 'mkd'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    createWindow(filePath);
  }
}

async function saveFile() {
  const activeWindow = getActiveWindowData();
  if (!activeWindow) return;

  if (activeWindow.filePath) {
    activeWindow.window.webContents.send('save-file');
  } else {
    saveFileAs();
  }
}

async function saveFileAs() {
  const activeWindow = getActiveWindowData();
  if (!activeWindow) return;

  const result = await dialog.showSaveDialog(activeWindow.window, {
    filters: [
      { name: 'Markdown Files', extensions: ['md'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled) {
    activeWindow.filePath = result.filePath;
    activeWindow.window.webContents.send('save-file-as', result.filePath);
    updateWindowTitle(activeWindow.id);
  }
}

function updateWindowTitle(windowId) {
  const windowData = windows.get(windowId);
  if (!windowData) return;

  const title = windowData.filePath
    ? `${path.basename(windowData.filePath)} - mdlens`
    : 'Untitled - mdlens';
  windowData.window.setTitle(title);

  // Also update the custom title bar if it exists
  windowData.window.webContents.send('update-title', title);
}

// Helper function to get window data from event
function getWindowDataFromEvent(event) {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  for (const [id, data] of windows.entries()) {
    if (data.window === senderWindow) {
      return data;
    }
  }
  return null;
}

// IPC handlers
ipcMain.handle('save-file-content', async (event, content) => {
  const windowData = getWindowDataFromEvent(event);
  if (!windowData) return { success: false, error: 'Window not found' };

  if (windowData.filePath) {
    try {
      await fs.writeFile(windowData.filePath, content, 'utf8');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: 'No file path specified' };
});

ipcMain.handle('save-file-as-content', async (event, { content, filePath }) => {
  const windowData = getWindowDataFromEvent(event);
  if (!windowData) return { success: false, error: 'Window not found' };

  try {
    await fs.writeFile(filePath, content, 'utf8');
    windowData.filePath = filePath;
    updateWindowTitle(windowData.id);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-vimrc', async () => {
  try {
    const vimrcConfig = await readVimrc();
    return { success: true, config: vimrcConfig };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

app.whenReady().then(() => {
  // Check for command line arguments
  const args = process.argv.slice(2);
  const filesToOpen = args.filter(arg => !arg.startsWith('-'));

  if (filesToOpen.length > 0) {
    // Open each file in a separate window
    filesToOpen.forEach(filePath => {
      if (fsSync.existsSync(filePath)) {
        createWindow(path.resolve(filePath));
      }
    });
  } else {
    // No files specified, create empty window
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
