import { ipcRenderer, webFrame } from 'electron';
import { parse } from 'url';
import { getAPI } from '../api';
import { IpcExtension } from '../models/ipc-extension';

declare const global: any;

global.isTab = false;

let sessionId = -1;

const arg = process.argv.find(x => x.startsWith('--session-id='));

if (arg) {
  try {
    sessionId = parseInt(arg.split('--session-id=')[1]);
  } catch (e) {
    console.log(e);
  }
}

// https://github.com/electron/electron/issues/11290#issuecomment-362301961
Object.defineProperty(window.navigator, 'userAgent', {
  value: window.navigator.userAgent.replace(/Electron\/\S*\s/, ''),
  configurable: false,
  writable: false,
});

ipcRenderer.setMaxListeners(0);

const extensionId = parse(window.location.href).hostname;

const extension: IpcExtension = ipcRenderer.sendSync(
  `get-extension-${sessionId}`,
  extensionId,
);

const updateBounds = () => {
  ipcRenderer.sendToHost(
    'webview-size',
    document.body.offsetWidth,
    document.body.offsetHeight,
  );
};

window.addEventListener('load', () => {
  setTimeout(() => {
    updateBounds();
  });

  window.addEventListener('resize', () => {
    updateBounds();
  });
});

window.addEventListener('blur', () => {
  ipcRenderer.sendToHost('webview-blur');
});

process.once('loaded', async () => {
  const api = getAPI(extension, sessionId);

  const w: any = await webFrame.executeJavaScript('window');
  w.chrome = w.browser = w.webext = api;
});
