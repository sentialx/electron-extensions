import { ipcRenderer, webFrame, remote, IpcMessageEvent } from 'electron';
import { readFileSync } from 'fs';
import { join } from 'path';

import { IpcExtension } from '../../models/ipc-extension';
import { injectContentScript } from './inject';

const sessionId: number = ipcRenderer.sendSync('get-session-id');

const extensions: { [key: string]: IpcExtension } = ipcRenderer.sendSync(
  `get-extensions-${sessionId}`,
);

webFrame.executeJavaScript('window', false, w => {
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
});

const setImmediateTemp: any = setImmediate;

process.once('loaded', () => {
  global.setImmediate = setImmediateTemp;

  Object.keys(extensions).forEach(key => {
    const extension = extensions[key];
    const { manifest } = extension;

    if (manifest.content_scripts) {
      const readArrayOfFiles = (relativePath: string) => ({
        url: `electron-extension://${extension.id}/${relativePath}`,
        code: readFileSync(join(extension.path, relativePath), 'utf8'),
      });

      try {
        manifest.content_scripts.forEach(script => {
          const newScript = {
            matches: script.matches,
            js: script.js ? script.js.map(readArrayOfFiles) : [],
            css: script.css ? script.css.map(readArrayOfFiles) : [],
            runAt: script.run_at || 'document_idle',
          };

          injectContentScript(newScript, extension, sessionId);
        });
      } catch (readError) {
        console.error('Failed to read content scripts', readError);
      }
    }
  });
});
