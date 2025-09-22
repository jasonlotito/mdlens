const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const os = require('os');

let windows = new Map(); // Store window instances and their file paths
let windowCounter = 0;

// Request single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  // Continue with normal app initialization
}

// Auto-save configuration
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds
const SCRATCH_DIR = path.join(os.homedir(), '.mdlens');
const SCRATCH_FILE = path.join(SCRATCH_DIR, 'scratch.md');
const SESSION_FILE = path.join(SCRATCH_DIR, 'session.json');

// Ensure scratch directory exists
async function ensureScratchDir() {
  try {
    await fs.mkdir(SCRATCH_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create scratch directory:', error);
  }
}

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

// Session management functions
async function saveSession() {
  try {
    const sessionData = {
      windows: [],
      timestamp: Date.now()
    };

    for (const [id, windowData] of windows.entries()) {
      if (!windowData.window.isDestroyed()) {
        sessionData.windows.push({
          id: id,
          filePath: windowData.filePath,
          hasUnsavedChanges: windowData.hasUnsavedChanges || false
        });
      }
    }

    await fs.writeFile(SESSION_FILE, JSON.stringify(sessionData, null, 2));
  } catch (error) {
    console.error('Failed to save session:', error);
  }
}

async function loadSession() {
  try {
    const sessionData = JSON.parse(await fs.readFile(SESSION_FILE, 'utf8'));
    return sessionData;
  } catch (error) {
    // Session file doesn't exist or is corrupted
    return null;
  }
}

async function clearSession() {
  try {
    await fs.unlink(SESSION_FILE);
  } catch (error) {
    // File doesn't exist, that's fine
  }
}

async function saveScratchFile(content) {
  try {
    await ensureScratchDir();
    await fs.writeFile(SCRATCH_FILE, content);
  } catch (error) {
    console.error('Failed to save scratch file:', error);
  }
}

async function loadScratchFile() {
  try {
    return await fs.readFile(SCRATCH_FILE, 'utf8');
  } catch (error) {
    return null;
  }
}

async function clearScratchFile() {
  try {
    await fs.unlink(SCRATCH_FILE);
  } catch (error) {
    // File doesn't exist, that's fine
  }
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
    id: windowId,
    hasUnsavedChanges: false,
    autoSaveTimer: null
  });

  window.loadFile(path.join(__dirname, 'index.html'));

  window.once('ready-to-show', () => {
    window.show();

    // If a file path was provided, open it
    if (filePath) {
      openFileInWindow(windowId, filePath);
    }
  });

  window.on('close', async (event) => {
    const windowData = windows.get(windowId);
    if (windowData && windowData.hasUnsavedChanges) {
      event.preventDefault();

      const choice = await dialog.showMessageBox(window, {
        type: 'question',
        buttons: ['Save', "Don't Save", 'Cancel'],
        defaultId: 0,
        message: 'Do you want to save your changes before closing?',
        detail: 'Your changes will be lost if you don\'t save them.'
      });

      if (choice.response === 0) { // Save
        window.webContents.send('save-before-close');
      } else if (choice.response === 1) { // Don't Save
        // Clear scratch file if this was the last window
        if (windows.size === 1) {
          await clearScratchFile();
        }
        windowData.hasUnsavedChanges = false;
        window.destroy();
      }
      // Cancel - do nothing, window stays open
    } else {
      // No unsaved changes, safe to close
      window.destroy();
    }
  });

  window.on('closed', () => {
    const windowData = windows.get(windowId);
    if (windowData && windowData.autoSaveTimer) {
      clearInterval(windowData.autoSaveTimer);
    }
    windows.delete(windowId);
    saveSession(); // Update session when window closes
  });

  // Set up the menu (will be shared across all windows)
  createMenu();

  return windowId;
}

// Helper function to get the currently focused window data
function getActiveWindowData() {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (!focusedWindow) {
    // If no focused window, try to get any available window
    if (windows.size > 0) {
      return windows.values().next().value;
    }
    return null;
  }

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
  if (!windowData) {
    console.error(`Window with ID ${windowId} not found`);
    return;
  }

  try {
    // Check if path exists and is a file
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      throw new Error(`Path is not a file: ${filePath}`);
    }

    const content = await fs.readFile(filePath, 'utf8');
    windowData.filePath = filePath;

    // Check if window still exists before sending message
    if (!windowData.window.isDestroyed()) {
      windowData.window.webContents.send('file-opened', { content, filePath });
      updateWindowTitle(windowId);
    }
  } catch (error) {
    console.error('Error opening file:', error);
    if (!windowData.window.isDestroyed()) {
      let errorMessage = `Could not open file: ${error.message}`;
      if (error.code === 'EISDIR') {
        errorMessage = `Cannot open directory as file: ${filePath}`;
      } else if (error.code === 'ENOENT') {
        errorMessage = `File not found: ${filePath}`;
      } else if (error.code === 'EACCES') {
        errorMessage = `Permission denied: ${filePath}`;
      }
      dialog.showErrorBox('Error', errorMessage);
    }
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
          label: 'Close Window',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            const activeWindow = getActiveWindowData();
            if (activeWindow) {
              activeWindow.window.close();
            }
          }
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
          accelerator: 'CmdOrCtrl+Shift+\\',
          click: () => {
            const activeWindow = getActiveWindowData();
            if (activeWindow) {
              activeWindow.window.webContents.send('toggle-view');
            } else {
              console.warn('No active window for toggle view');
            }
          }
        },
        {
          label: 'Toggle Vim Mode',
          accelerator: 'CmdOrCtrl+Shift+V',
          click: () => {
            const activeWindow = getActiveWindowData();
            if (activeWindow) {
              activeWindow.window.webContents.send('toggle-vim');
            } else {
              console.warn('No active window for toggle vim');
            }
          }
        },
        {
          label: 'Reload .vimrc',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            const activeWindow = getActiveWindowData();
            if (activeWindow) {
              activeWindow.window.webContents.send('reload-vimrc');
            } else {
              console.warn('No active window for reload vimrc');
            }
          }
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
          click: () => {
            const activeWindow = getActiveWindowData();
            if (activeWindow) {
              activeWindow.window.webContents.toggleDevTools();
            } else {
              console.warn('No active window for dev tools');
            }
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'CmdOrCtrl+Shift+?',
          click: () => {
            const activeWindow = getActiveWindowData();
            if (activeWindow) {
              activeWindow.window.webContents.send('show-help');
            } else {
              console.warn('No active window for help');
            }
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
  if (!activeWindow) {
    // No windows available, create a new one
    createWindow();
    return;
  }

  activeWindow.filePath = null;
  activeWindow.window.webContents.send('new-file');
  updateWindowTitle(activeWindow.id);
}

async function openFile() {
  const activeWindow = getActiveWindowData();
  if (!activeWindow) {
    // No windows available, open file in new window
    openFileInNewWindow();
    return;
  }

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
  if (!activeWindow) {
    console.warn('No active window available for save operation');
    return;
  }

  if (activeWindow.filePath) {
    activeWindow.window.webContents.send('save-file');
  } else {
    saveFileAs();
  }
}

async function saveFileAs() {
  const activeWindow = getActiveWindowData();
  if (!activeWindow) {
    console.warn('No active window available for save as operation');
    return;
  }

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
  if (!windowData || windowData.window.isDestroyed()) {
    return;
  }

  const title = windowData.filePath
    ? `${path.basename(windowData.filePath)} - mdlens`
    : 'Untitled - mdlens';

  try {
    windowData.window.setTitle(title);
    // Also update the custom title bar if it exists
    windowData.window.webContents.send('update-title', title);
  } catch (error) {
    console.error('Error updating window title:', error);
  }
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

ipcMain.handle('has-current-file', async (event) => {
  const windowData = getWindowDataFromEvent(event);
  return windowData && windowData.filePath ? true : false;
});

ipcMain.handle('load-vimrc', async () => {
  try {
    const vimrcConfig = await readVimrc();
    return { success: true, config: vimrcConfig };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Auto-save and recovery IPC handlers
ipcMain.handle('auto-save-content', async (event, content) => {
  await saveScratchFile(content);
  return { success: true };
});

ipcMain.handle('load-scratch', async () => {
  try {
    const content = await loadScratchFile();
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('clear-scratch', async () => {
  try {
    await clearScratchFile();
    await clearSession();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('mark-unsaved-changes', async (event, hasChanges) => {
  const windowData = getWindowDataFromEvent(event);
  if (windowData) {
    windowData.hasUnsavedChanges = hasChanges;
    saveSession(); // Update session when changes state changes
  }
  return { success: true };
});

ipcMain.handle('get-recovery-data', async () => {
  try {
    const session = await loadSession();
    const scratchContent = await loadScratchFile();

    return {
      success: true,
      session,
      scratchContent,
      hasScratch: !!scratchContent
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.on('file-saved-successfully', (event) => {
  const windowData = getWindowDataFromEvent(event);
  if (windowData) {
    windowData.hasUnsavedChanges = false;
    saveSession();
  }
});

// Handle external link opening
ipcMain.handle('open-external', async (event, url) => {
  try {
    // Validate URL to prevent security issues
    const urlObj = new URL(url);
    const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:'];

    if (allowedProtocols.includes(urlObj.protocol)) {
      await shell.openExternal(url);
      return { success: true };
    } else {
      console.warn('Blocked attempt to open URL with unsupported protocol:', url);
      return { success: false, error: 'Unsupported protocol' };
    }
  } catch (error) {
    console.error('Failed to open external URL:', error);
    return { success: false, error: error.message };
  }
});

app.whenReady().then(async () => {
  await ensureScratchDir();

  // Register file associations for markdown files
  if (process.platform === 'win32') {
    app.setAsDefaultProtocolClient('mdlens');
  }

  // Set app user model ID for Windows
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.mdlens.app');
  }

  // Check for command line arguments
  const args = process.argv.slice(2);
  const filesToOpen = args.filter(arg => !arg.startsWith('-'));

  if (filesToOpen.length > 0) {
    // Open each file in a separate window
    filesToOpen.forEach(filePath => {
      if (fsSync.existsSync(filePath)) {
        const stats = fsSync.statSync(filePath);
        if (stats.isFile()) {
          createWindow(path.resolve(filePath));
        } else {
          console.warn(`Skipping directory: ${filePath}`);
        }
      }
    });
  } else {
    // Check for crash recovery
    const session = await loadSession();
    const scratchContent = await loadScratchFile();

    if (scratchContent && session && session.windows.length > 0) {
      // Potential crash recovery scenario
      const hasUnsavedWork = session.windows.some(w => w.hasUnsavedChanges);

      if (hasUnsavedWork) {
        // Create window and let renderer handle recovery
        createWindow();
      } else {
        // Clean session, clear scratch and start fresh
        await clearScratchFile();
        await clearSession();
        createWindow();
      }
    } else {
      // No recovery needed, create empty window
      createWindow();
    }
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

// Handle file opening on macOS
app.on('open-file', (event, filePath) => {
  event.preventDefault();

  // Check if it's actually a file, not a directory
  if (fsSync.existsSync(filePath)) {
    const stats = fsSync.statSync(filePath);
    if (!stats.isFile()) {
      console.warn(`Skipping directory: ${filePath}`);
      return;
    }
  }

  if (app.isReady()) {
    // App is already running, open file in new window
    createWindow(filePath);
  } else {
    // App is starting, store file to open after ready
    process.argv.push(filePath);
  }
});

// Handle file opening on Windows/Linux via second instance
app.on('second-instance', (event, commandLine, workingDirectory) => {
  // Someone tried to run a second instance, focus existing window instead
  const args = commandLine.slice(2);
  const filesToOpen = args.filter(arg => {
    if (arg.startsWith('-')) return false;
    if (!fsSync.existsSync(arg)) return false;
    const stats = fsSync.statSync(arg);
    return stats.isFile();
  });

  if (filesToOpen.length > 0) {
    // Open each file in a separate window
    filesToOpen.forEach(filePath => {
      createWindow(path.resolve(filePath));
    });
  } else {
    // No files, just focus an existing window or create new one
    const existingWindow = BrowserWindow.getAllWindows()[0];
    if (existingWindow) {
      if (existingWindow.isMinimized()) existingWindow.restore();
      existingWindow.focus();
    } else {
      createWindow();
    }
  }
});
