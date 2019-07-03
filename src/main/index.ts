import { Session, IpcMessageEvent, ipcMain } from 'electron';
import { resolve, basename } from 'path';
import { promises, existsSync } from 'fs';

import { getPath } from '../utils/paths';
import { Extension } from '../models/extension';
import { registerProtocols } from './services/protocols';
import { runWebRequestService } from './services/web-request';
import { runMessagingService } from './services/messaging';
import { StorageArea } from '../models/storage-area';
import { startBackgroundPage } from '../utils/extensions';

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
  }

  async loadExtension(dir: string, { devtools } = { devtools: false }) {
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

    const storagePath = getPath('storage/extensions', id);
    const local = new StorageArea(resolve(storagePath, 'local'));
    const sync = new StorageArea(resolve(storagePath, 'sync'));
    const managed = new StorageArea(resolve(storagePath, 'managed'));

    const extension: Extension = {
      manifest,
      alarms: [],
      databases: { local, sync, managed },
      path: dir,
      id,
    };

    this.extensions[id] = extension;

    if (typeof manifest.default_locale === 'string') {
      const defaultLocalePath = resolve(
        dir,
        '_locales',
        manifest.default_locale,
      );

      if (!existsSync(defaultLocalePath)) return;

      const messagesPath = resolve(defaultLocalePath, 'messages.json');
      const stats = await promises.stat(messagesPath);

      if (!existsSync(messagesPath) || stats.isDirectory()) return;

      const data = await promises.readFile(messagesPath, 'utf8');
      const locale = JSON.parse(data);

      extension.locale = locale;
    }

    startBackgroundPage(extension, devtools);
  }
}
