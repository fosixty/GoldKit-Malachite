const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { YtDlpRunner } = require('./ytdlp');
const {
  readHistory,
  addHistoryEntry,
  updateHistoryEntry,
  clearHistory,
} = require('./history');

const isDev = !app.isPackaged;
let mainWindow = null;

function getAppIcon() {
  const devIcon = path.join(__dirname, '..', 'assets', 'icon.png');
  if (!app.isPackaged) {
    return devIcon;
  }
  const packagedIcon = path.join(process.resourcesPath, 'assets', 'icon.png');
  return require('fs').existsSync(packagedIcon) ? packagedIcon : devIcon;
}
let activeEntryId = null;
const runner = new YtDlpRunner();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 720,
    minWidth: 640,
    minHeight: 520,
    icon: getAppIcon(),
    backgroundColor: '#09090b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function send(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function registerIpc() {
  ipcMain.handle('dialog:selectDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle('app:getDefaultOutputDir', () => {
    return app.getPath('downloads');
  });

  ipcMain.handle('history:get', () => readHistory());

  ipcMain.handle('history:clear', () => {
    clearHistory();
    return true;
  });

  ipcMain.handle('download:cancel', () => {
    return runner.cancel();
  });

  ipcMain.handle('download:start', async (_event, { url, outputDir, format }) => {
    if (!url || !outputDir) {
      throw new Error('URL and output directory are required');
    }

    if (runner.isRunning()) {
      throw new Error('A download is already in progress');
    }

    const entry = addHistoryEntry({ url, format, outputDir });
    activeEntryId = entry.id;

    runner.start(
      { url, outputDir, format },
      {
        onLog: (data) => send('download:log', data),
        onProgress: (data) => send('download:progress', data),
        onDone: ({ code, cancelled, title, outputPath }) => {
          updateHistoryEntry(activeEntryId, {
            status: cancelled ? 'cancelled' : 'completed',
            title,
            outputPath,
            finishedAt: new Date().toISOString(),
          });
          send('download:done', { code, cancelled, title, outputPath, entryId: activeEntryId });
          activeEntryId = null;
        },
        onError: ({ code, message, title, outputPath }) => {
          updateHistoryEntry(activeEntryId, {
            status: 'failed',
            title,
            outputPath,
            finishedAt: new Date().toISOString(),
          });
          send('download:error', { code, message, title, outputPath, entryId: activeEntryId });
          activeEntryId = null;
        },
      }
    );

    return entry;
  });
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (runner.isRunning()) {
    runner.cancel();
  }
});
