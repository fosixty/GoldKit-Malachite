const { app, BrowserWindow, ipcMain, dialog, Menu, session, shell } = require('electron');
const path = require('path');
const { YtDlpRunner } = require('./ytdlp');
const { classifyDownloadError } = require('./download-errors');
const { createTextContextMenuTemplate } = require('./text-context-menu');
const {
  LEGAL_NOTICE_DETAIL,
  LEGAL_NOTICE_MESSAGE,
  LEGAL_NOTICE_TITLE,
  disableYouTubeAuthorizationPrompt,
  hasDisabledYouTubeAuthorizationPrompt,
  hasAcceptedLegalNotice,
  recordLegalNoticeAcceptance,
} = require('./legal');
const {
  canonicalizeDirectory,
  directoryKey,
  isYouTubeUrl,
  validateDownloadOptions,
} = require('./validation');
const {
  readHistory,
  addHistoryEntry,
  updateHistoryEntry,
  clearHistory,
} = require('./history');

const isDev = !app.isPackaged;
let mainWindow = null;
const authorizedOutputDirectories = new Set();

if (isDev) {
  const devUserDataPath = path.join(__dirname, '..', '.dev-data');
  require('fs').mkdirSync(devUserDataPath, { recursive: true });
  app.setPath('userData', devUserDataPath);
}

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
    backgroundColor: '#101210',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault());
  mainWindow.webContents.on('context-menu', (_event, params) => {
    if (!params.isEditable || !mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    Menu.buildFromTemplate(createTextContextMenuTemplate(params.editFlags)).popup({
      window: mainWindow,
    });
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

function assertTrustedEvent(event) {
  if (
    !mainWindow ||
    mainWindow.isDestroyed() ||
    event.sender !== mainWindow.webContents ||
    event.senderFrame !== event.sender.mainFrame
  ) {
    throw new Error('Unauthorized IPC request');
  }
}

function authorizeDirectory(directory) {
  const canonical = canonicalizeDirectory(directory);
  authorizedOutputDirectories.add(directoryKey(canonical));
  return canonical;
}

function handleTrusted(channel, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    assertTrustedEvent(event);
    return handler(...args);
  });
}

async function confirmResponsibleUse() {
  const userDataPath = app.getPath('userData');
  if (hasAcceptedLegalNotice(userDataPath)) {
    return true;
  }

  while (true) {
    const result = await dialog.showMessageBox({
      type: 'warning',
      title: LEGAL_NOTICE_TITLE,
      message: LEGAL_NOTICE_MESSAGE,
      detail: LEGAL_NOTICE_DETAIL,
      buttons: ['Quit', 'Open Licenses', 'I Agree'],
      defaultId: 2,
      cancelId: 0,
      noLink: true,
    });

    if (result.response === 0) {
      return false;
    }
    if (result.response === 1) {
      const licensesPath = app.isPackaged
        ? path.join(process.resourcesPath, 'legal', 'licenses.html')
        : path.join(__dirname, '..', 'legal', 'licenses.html');
      const error = await shell.openPath(licensesPath);
      if (error) {
        await dialog.showMessageBox({
          type: 'error',
          title: 'Could Not Open Licenses',
          message: 'The licenses and notices page could not be opened.',
          detail: error,
          buttons: ['OK'],
        });
      }
      continue;
    }
    break;
  }

  try {
    recordLegalNoticeAcceptance(userDataPath);
  } catch (error) {
    console.error('Could not save legal notice acceptance:', error);
  }
  return true;
}

async function confirmYouTubeAuthorization(url) {
  if (!isYouTubeUrl(url)) {
    return true;
  }

  const userDataPath = app.getPath('userData');
  if (hasDisabledYouTubeAuthorizationPrompt(userDataPath)) {
    return true;
  }

  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'YouTube Authorization Required',
    message: 'Confirm that this download is authorized by YouTube’s Terms.',
    detail: [
      'YouTube generally prohibits downloading Content unless the Service expressly authorizes it or YouTube and the applicable rights holder have given prior written permission.',
      '',
      'Continue only if one of those conditions applies and your use complies with applicable law. Malachite does not verify or grant permission.',
    ].join('\n'),
    buttons: ['Cancel', 'I Confirm Authorization'],
    defaultId: 0,
    cancelId: 0,
    checkboxLabel: 'Do not ask again',
    checkboxChecked: false,
    noLink: true,
  });

  const confirmed = result.response === 1;
  if (confirmed && result.checkboxChecked) {
    try {
      disableYouTubeAuthorizationPrompt(userDataPath);
    } catch (error) {
      console.error('Could not save YouTube authorization preference:', error);
    }
  }

  return confirmed;
}

function registerIpc() {
  handleTrusted('dialog:selectDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return authorizeDirectory(result.filePaths[0]);
  });

  handleTrusted('app:getDefaultOutputDir', () => {
    return authorizeDirectory(app.getPath('downloads'));
  });

  handleTrusted('history:get', () => readHistory());

  handleTrusted('history:clear', () => {
    clearHistory();
    return true;
  });

  handleTrusted('download:cancel', () => {
    return runner.cancel();
  });

  handleTrusted('download:start', async (payload) => {
    if (runner.isRunning()) {
      throw new Error('A download is already in progress');
    }

    const { url, outputDir, format } = validateDownloadOptions(
      payload,
      authorizedOutputDirectories
    );

    if (!(await confirmYouTubeAuthorization(url))) {
      throw new Error('YouTube download cancelled: authorization was not confirmed');
    }

    let preparedTools;
    try {
      preparedTools = runner.prepare();
    } catch (error) {
      console.error('Media tools validation failed:', error.code || error.name);
      send('download:error', {
        ...classifyDownloadError({ processError: error }),
        exitCode: null,
        rawStderr: '',
        mediaTitle: null,
        outputPath: null,
        entryId: null,
      });
      return null;
    }

    const entry = addHistoryEntry({ url, format, outputDir });
    activeEntryId = entry.id;

    runner.start(
      {
        url,
        outputDir,
        format,
        ffmpegLocation: preparedTools.directory,
        nodePath: preparedTools.javascriptRuntime.executable,
      },
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
        onError: (error) => {
          updateHistoryEntry(activeEntryId, {
            status: 'failed',
            title: error.mediaTitle,
            outputPath: error.outputPath,
            finishedAt: new Date().toISOString(),
          });
          send('download:error', { ...error, entryId: activeEntryId });
          activeEntryId = null;
        },
      }
    );

    return entry;
  });
}

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  session.defaultSession.setPermissionCheckHandler(() => false);
  registerIpc();

  if (!(await confirmResponsibleUse())) {
    app.quit();
    return;
  }

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
