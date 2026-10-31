const { app, BrowserWindow, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Expose the packaged app version to the embedded server so the Desktop
// settings can compare it against the latest GitHub Release (app self-update).
try {
  process.env.APP_VERSION = app.getVersion();
} catch {
  /* ignore */
}

// Start the Express server; it exports a `ready` promise.
const { ready } = require('./server');

function resolveIcon() {
  // Same atom brand everywhere. `build/icon.png` is what electron-builder also
  // uses for the OS taskbar/installer icon (dev tree); the packaged app ships
  // the Vite build under client/dist, so the built icon.png lives there.
  const candidates = [
    path.join(__dirname, '../build/icon.png'),
    path.join(__dirname, '../client/dist/icon.png'),
    path.join(__dirname, '../client/public/icon.png'),
  ];
  return candidates.find((c) => fs.existsSync(c));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f0f10',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: resolveIcon(),
  });

  win.removeMenu();

  // Open external links (GitHub releases, help pages) in the user's real
  // browser instead of navigating the app window away from the UI.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url).catch(() => {});
    }
    return { action: 'deny' };
  });

  // The embedded server resolves with the port it actually bound — 3000 may be
  // taken by a dev server or a second app instance.
  ready
    .then((port) => win.loadURL(`http://localhost:${port}`))
    .catch((err) => {
      console.error('Failed to start embedded server:', err);
      dialog.showErrorBox(
        'StreamPull failed to start',
        (err && err.message) || 'The local server could not be started.',
      );
      app.quit();
    });

  win.webContents.on('did-fail-load', (_e, code, description) => {
    if (code === -3) return; // aborted (reload/navigation)
    dialog.showErrorBox('StreamPull could not load its UI', `${code} ${description}`);
  });

  // Only open devtools when explicitly requested (never in a shipped build).
  if (process.env.DEVTOOLS === '1') win.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
