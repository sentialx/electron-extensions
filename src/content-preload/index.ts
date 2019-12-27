import { ipcRenderer, webFrame } from 'electron';

import { IpcExtension } from '../models/ipc-extension';
import { injectContentScript } from './inject';

declare const global: any;

const sessionId: number = ipcRenderer.sendSync('get-session-id');

const arg = process.argv.find(x => x.startsWith('--blacklist='));

let blackList: string[] = [];

global.isTab = true;

if (arg) {
  try {
    blackList = JSON.parse(arg.split('--blacklist=')[1]);
  } catch (e) {
    console.log(e);
  }
}

if (sessionId !== -1) {
  (async function() {
    const w: any = await webFrame.executeJavaScript('window');
    w.chrome = {
      webstorePrivate: {
        install: () => {},
      },
      app: {
        isInstalled: false,
        getIsInstalled: () => {
          return false;
        },
        getDetails: () => {},
        installState: () => {},
      },
    };
  })();

  const setImmediateTemp: any = setImmediate;

  const extensions: { [key: string]: IpcExtension } = ipcRenderer.sendSync(
    `get-extensions-${sessionId}`,
  );

  process.once('loaded', () => {
    global.setImmediate = setImmediateTemp;

    if (blackList.find(x => window.location.href.startsWith(x))) return;

    Object.keys(extensions).forEach(key => {
      const extension = extensions[key];

      extension.contentScripts.forEach(script => {
        injectContentScript(script, extension, sessionId);
      });
    });
  });
}
