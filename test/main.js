const { app, BrowserWindow } = require('electron');
const { ExtensibleSession } = require('../build/main');
const { resolve } = require('path');

let mainWindow;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      sandbox: true,
      enableRemoteModule: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const extensions = new ExtensibleSession();
  const extension = await extensions.loadExtension(
    resolve(app.getAppPath(), './extension'),
  );
  extension.backgroundPage.webContents.openDevTools();

  mainWindow.loadFile('index.html');
  mainWindow.on('closed', function() {
    mainWindow = null;
  });
  mainWindow.openDevTools();
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
