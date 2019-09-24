import {
  Session,
  ipcMain,
  app,
  WebContents,
  BrowserWindow,
  webContents,
} from 'electron';
import { resolve, basename } from 'path';
import { promises, existsSync } from 'fs';

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
  getAllWebContentsInSession,
  webContentsValid,
  webContentsToTab,
} from '../utils/web-contents';
import { hookWebContentsEvents } from './services/web-navigation';
import { IpcExtension } from '../models/ipc-extension';
import { IStorage } from '../models/storage';

let id = 1;

const sessions: ExtensibleSession[] = [];

export const storages: Map<string, IStorage> = new Map();

if (ipcMain) {
  ipcMain.on('get-session-id', e => {
    let ses = sessions.find(x => x.session === e.sender.session);

    if (ses) {
      e.returnValue = ses.id;
    } else {
      ses = sessions.find(x => {
        const extension = Object.values(x.extensions).find(
          x => x.backgroundPage.webContents.id === e.sender.id,
        );
        return !!extension;
      });
      if (ses) {
        e.returnValue = ses.id;
        return;
      }
    }

    /*const wc = webContents
      .getAllWebContents()
      .find(
        x =>
          x.devToolsWebContents &&
          x.devToolsWebContents.getType() === e.sender.getType(),
      );

    console.log(wc);

    if (wc) {
      const s = sessions.find(x => x.session === wc.session);
      if (s) {
        e.returnValue = s.id;
        return;
      }
    }*/

    e.returnValue = -1;
  });
}

export interface IOptions {
  contentPreloadPath?: string;
  backgroundPreloadPath?: string;
}

export class ExtensibleSession {
  public extensions: { [key: string]: IpcExtension } = {};

  public id = id++;

  public webContents: WebContents[] = [];

  public lastActiveWebContents: WebContents;

  private _initialized = false;

  private options: IOptions = {
    contentPreloadPath: resolve(__dirname, 'content-preload.bundle.js'),
    backgroundPreloadPath: resolve(__dirname, 'background-preload.bundle.js'),
  };

  constructor(public session: Session, options: IOptions = {}) {
    registerProtocols(this);

    this.options = { ...this.options, ...options };

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
      this.session.setPreloads(
        this.session.getPreloads().concat([this.options.contentPreloadPath]),
      );

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

    const extension = await loadExtension(
      manifest,
      this.id,
      this.options.backgroundPreloadPath,
    );
    this.extensions[id] = extension;

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
      (e, extensionId: string, tabId: number) => {
        const tab = webContentsToTab(webContents.fromId(tabId));
        this.extensions[extensionId].backgroundPage.webContents.send(
          'api-emit-event-browserAction-onClicked',
          tab,
        );
      },
    );

    ipcMain.on(`get-extensions-${window.webContents.id}`, e => {
      const list = { ...this.extensions };

      for (const key in list) {
        list[key] = getIpcExtension(list[key]);
      }

      e.returnValue = list;
    });
  }
}
