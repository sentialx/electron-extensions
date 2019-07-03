import { Session, IpcMessageEvent, ipcMain, app } from 'electron';
import { resolve, basename } from 'path';
import { promises, existsSync } from 'fs';

import { Extension } from '../models/extension';
import { registerProtocols } from './services/protocols';
import { runWebRequestService } from './services/web-request';
import { runMessagingService } from './services/messaging';
import { loadDevToolsExtensions, loadExtension } from '../utils/extensions';
import { hookWebContentsEvents } from '../utils/web-contents';

let id = 1;

const sessions: ExtensibleSession[] = [];

ipcMain.on('get-session-id', (e: IpcMessageEvent) => {
  e.returnValue = sessions.find(x => x.session === e.sender.session).id;
});

export class ExtensibleSession {
  public extensions: { [key: string]: Extension } = {};

  public id = id++;

  private _initialized = false;

  constructor(public session: Session) {
    registerProtocols(this);

    app.on('web-contents-created', (e, webContents) => {
      const type = webContents.getType();
      if (type !== 'window' && type !== 'webview' && type !== 'browserView') {
        return;
      }

      hookWebContentsEvents(this, webContents);

      webContents.on('devtools-opened', () => {
        const manifests = Object.values(this.extensions).map(
          item => item.manifest,
        );
        loadDevToolsExtensions(webContents, manifests);
      });
    });
  }

  async loadExtension(dir: string) {
    if (!this._initialized) {
      this.session.setPreloads([`${__dirname}/../renderer/content/index.js`]);

      runWebRequestService(this);
      runMessagingService(this);

      this._initialized = true;
    }

    const stats = await promises.stat(dir);

    if (!stats.isDirectory()) throw new Error('Given path is not a directory');

    const manifestPath = resolve(dir, 'manifest.json');

    if (!existsSync(manifestPath)) {
      throw new Error("Given directory doesn't contain manifest.json file");
    }

    const manifest: chrome.runtime.Manifest = JSON.parse(
      await promises.readFile(manifestPath, 'utf8'),
    );

    const id = basename(dir);

    if (this.extensions[id]) {
      return;
    }

    manifest.srcDirectory = dir;
    manifest.extensionId = id;

    const extension = await loadExtension(manifest);

    this.extensions[id] = extension;
  }
}
