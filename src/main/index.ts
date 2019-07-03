import {
  Session,
  IpcMessageEvent,
  ipcMain,
  app,
  WebContents,
  BrowserWindow,
  webContents,
} from 'electron';
import { resolve, basename } from 'path';
import { promises, existsSync } from 'fs';

import { Extension } from '../models/extension';
import { registerProtocols } from './services/protocols';
import { runWebRequestService } from './services/web-request';
import { runMessagingService } from './services/messaging';
import {
  loadDevToolsExtensions,
  loadExtension,
  extensionsToManifests,
  getIpcExtension,
} from '../utils/extensions';
import {
  hookWebContentsEvents,
  getAllWebContentsInSession,
  webContentsValid,
  webContentsToTab,
} from '../utils/web-contents';

let id = 1;

const sessions: ExtensibleSession[] = [];

export const extensions: { [key: string]: Extension } = {};

if (ipcMain) {
  ipcMain.on('get-session-id', (e: IpcMessageEvent) => {
    const ses = sessions.find(x => x.session === e.sender.session);

    if (ses) {
      e.returnValue = ses.id;
    } else {
      const ses = sessions.find(x => {
        const extension = Object.values(x.extensions).find(
          x => x.backgroundPage.webContents.id === e.sender.id,
        );
        return !!extension;
      });
      e.returnValue = ses.id;
    }
  });
}

export class ExtensibleSession {
  public extensions: { [key: string]: Extension } = {};

  public id = id++;

  public webContents: WebContents[] = [];

  public lastActiveWebContents: WebContents;

  private _initialized = false;

  constructor(public session: Session) {
    registerProtocols(this);

    sessions.push(this);

    app.on('web-contents-created', (e, webContents) => {
      if (!webContentsValid(webContents)) return;

      hookWebContentsEvents(this, webContents);

      webContents.on('devtools-opened', () => {
        loadDevToolsExtensions(
          webContents,
          extensionsToManifests(this.extensions),
        );
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
      return this.extensions[id];
    }

    manifest.srcDirectory = dir;
    manifest.extensionId = id;

    const extension = await loadExtension(manifest, this.id);
    this.extensions[id] = extension;
    extensions[id] = extension;

    const webContents = getAllWebContentsInSession(this.session);

    for (const contents of webContents) {
      if (!webContentsValid(contents)) continue;
      loadDevToolsExtensions(contents, extensionsToManifests(this.extensions));
    }

    return extension;
  }

  addWindow(window: BrowserWindow) {
    this.webContents.push(window.webContents);

    if (window.isFocused()) this.lastActiveWebContents = window.webContents;

    window.on('focus', () => {
      this.lastActiveWebContents = window.webContents;
    });

    ipcMain.on(
      `api-browserAction-onClicked-${window.webContents.id}`,
      (e: IpcMessageEvent, extensionId: string, tabId: number) => {
        const tab = webContentsToTab(webContents.fromId(tabId));
        this.extensions[extensionId].backgroundPage.webContents.send(
          'api-emit-event-browserAction-onClicked',
          tab,
        );
      },
    );

    ipcMain.on(
      `get-extensions-${window.webContents.id}`,
      (e: IpcMessageEvent) => {
        const list = { ...this.extensions };

        for (const key in list) {
          list[key] = getIpcExtension(list[key]);
        }

        e.returnValue = list;
      },
    );
  }
}
