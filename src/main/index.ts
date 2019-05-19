import { Session } from 'electron';
import { resolve } from 'path';
import { promises, existsSync } from 'fs';
import enhanceWebRequest from 'electron-better-web-request';

import { Extension, StorageArea } from './models';
import { startBackgroundPage } from './utils/extensions';
import {
  runWebRequestService,
  runMessagingService,
  registerProtocols,
} from './services';
import { getPath } from '../utils/paths';

export class ExtensionsMain {
  public extensions: { [key: string]: Extension } = {};

  constructor() {
    registerProtocols(this);
    runMessagingService(this);
  }

  public setSession(ses: Session) {
    enhanceWebRequest(ses);

    ses.setPreloads([`${__dirname}/../renderer/content/index.js`]);

    runWebRequestService(ses);
  }

  public async load(dir: string) {
    const stats = await promises.stat(dir);

    if (!stats.isDirectory()) throw new Error('Given path is not a directory');

    const manifestPath = resolve(dir, 'manifest.json');

    if (!existsSync(manifestPath)) {
      throw new Error("Given directory doesn't contain manifest.json file");
    }

    const manifest: chrome.runtime.Manifest = JSON.parse(
      await promises.readFile(manifestPath, 'utf8'),
    );

    const id = dir.toLowerCase();

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

    startBackgroundPage(extension);
  }
}
