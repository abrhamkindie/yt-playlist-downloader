const { app, BrowserWindow } = require('electron');
const path = require('path');

// Start the Express server
require('./server');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
        icon: path.join(__dirname, 'public/favicon.ico') // Assuming there might be one, or default
    });

    // Load the local server
    // We need to wait a bit for the server to start, or just load it. 
    // Since server.js starts immediately, it should be fine.
    // Ideally, server.js should export a promise or event, but for this simple wrap:
    setTimeout(() => {
        win.loadURL('http://localhost:3000');
    }, 1000);

    // Remove menu bar for a cleaner "app" look, or keep it for dev tools
    // win.setMenu(null); 
}

app.whenReady().then(() => {
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
    // Note: The express server process will die when the main process exits
});
