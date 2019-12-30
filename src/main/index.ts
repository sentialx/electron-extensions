import { session, ipcMain, app, BrowserWindow, webContents } from 'electron';
import { resolve, basename } from 'path';
import { promises, existsSync } from 'fs';

import { registerProtocols } from './services/protocols';
import { runWebRequestService } from './services/web-request';
import { runMessagingService } from './services/messaging';
import {
  loadExtension,
  getIpcExtension,
  startBackgroundPage,
} from '../utils/extensions';
import { webContentsValid, webContentsToTab } from '../utils/web-contents';
import { hookWebContentsEvents } from './services/web-navigation';
import { IpcExtension } from '../models/ipc-extension';
import { IStorage } from '../models/storage';
import { EventEmitter } from 'events';

let id = 1;

const sessions: ExtensibleSession[] = [];

export const storages: Map<string, IStorage> = new Map();

ipcMain.on('get-session-id', e => {
  const ses = sessions.find(x => x.session === e.sender.session);

  if (ses) {
    e.returnValue = ses.id;
    return;
  }

  e.returnValue = -1;
});

ipcMain.on('send-msg-webcontents', (e, webContentsId, channel, ...message) => {
  webContents.fromId(webContentsId).send(channel, ...message);
});

ipcMain.on('get-webcontents-id', e => {
  e.returnValue = e.sender.id;
});

export interface IOptions {
  preloadPath?: string;
  blacklist?: string[];
  partition?: string;
}

export declare interface ExtensibleSession {
  on(
    event: 'create-tab',
    listener: (
      details: chrome.tabs.CreateProperties,
      callback: (tabId: number) => void,
    ) => void,
  ): this;

  on(
    event: 'set-badge-text',
    listener: (
      extensionId: string,
      details: chrome.browserAction.BadgeTextDetails,
    ) => void,
  ): this;

  on(event: string, listener: Function): this;
}

export class ExtensibleSession extends EventEmitter {
  public extensions: { [key: string]: IpcExtension } = {};

  public id = id++;

  public windows: BrowserWindow[] = [];

  // Last active window
  public lastFocusedWindow: BrowserWindow;

  public session: Electron.Session;

  public activeTab = -1;
  public partition: string;
  public blacklist: string[] = [];

  private _configured = false;
  private _initialized = false;

  private _options: IOptions = {
    preloadPath: resolve(__dirname, 'preload.js'),
    blacklist: [],
    partition: null,
  };

  constructor(options: IOptions = {}) {
    super();

    this._options = { ...this._options, ...options };
    this.partition = this._options.partition;
    this.blacklist = this._options.blacklist;

    sessions.push(this);

    this._init();

    app.on('web-contents-created', (e, webContents) => {
      if (
        !webContentsValid(webContents) ||
        webContents.session !== this.session
      )
        return;

      hookWebContentsEvents(this, webContents);

      /*webContents.on('devtools-opened', () => {
        loadDevToolsExtensions(
          webContents,
          extensionsToManifests(this.extensions),
          this.options.contentPreloadPath,
        );
      });*/
    });
  }

  private async _init() {
    if (!app.isReady()) await app.whenReady();

    this.session = this.partition
      ? session.fromPartition(this.partition)
      : session.defaultSession;

    registerProtocols(this);

    this._initialized = true;
  }

  async loadExtension(dir: string) {
    if (!this._initialized) throw new Error('App is not ready');

    if (!this._configured) {
      this.session.setPreloads(
        this.session.getPreloads().concat([this._options.preloadPath]),
      );

      runWebRequestService(this);
      runMessagingService(this);

      this._configured = true;
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

    const extension = await loadExtension(manifest);

    extension.backgroundPage = await startBackgroundPage(
      manifest,
      this._options.preloadPath,
      this.partition,
    );

    this.extensions[id] = extension;

    /*const webContents = getAllWebContentsInSession(this.session);

    for (const contents of webContents) {
      if (!webContentsValid(contents)) continue;
      loadDevToolsExtensions(contents, extensionsToManifests(this.extensions));
    }*/

    return extension;
  }

  addWindow(window: BrowserWindow) {
    this.windows.push(window);

    if (window.isFocused()) this.lastFocusedWindow = window;

    window.on('focus', () => {
      this.lastFocusedWindow = window;
    });

    ipcMain.on(
      `api-browserAction-onClicked-${window.webContents.id}`,
      (e, extensionId: string, tabId: number) => {
        const tab = webContentsToTab(webContents.fromId(tabId), this);
        const { backgroundPage, popupPage } = this.extensions[extensionId];

        /*
        TODO(sentialx):
        getAllWebContentsInSession(this.session).forEach(x => {
          if (x.id !== e.sender.id) {
            x.send('api-emit-event-browserAction-onClicked', tab, extensionId);
          }
        });*/

        if (backgroundPage && !popupPage) {
          backgroundPage.webContents.send(
            'api-emit-event-browserAction-onClicked',
            tab,
          );
        }
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
