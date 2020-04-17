import { Tab } from '../interfaces/tabs';
import { ipcMain, BrowserWindow } from 'electron';
import { promises } from 'fs';
import { resolve } from 'path';
import { sessionFromIpcEvent } from '../utils/session';
import { sendToHosts } from './background-pages';
import { EventEmitter } from 'events';

const getParentWindowOfTab = (tab: Tab) => {
  switch (tab.getType()) {
    case 'window':
      return BrowserWindow.fromWebContents(tab);
    case 'browserView':
    case 'webview':
      return (tab as any).getOwnerBrowserWindow();
  }
  return undefined;
};

// Events which can be registered only once
interface ITabsEvents {
  onCreateTabDetails: (tab: Tab, details: chrome.tabs.Tab) => void;
  onCreateTab: (details: chrome.tabs.CreateProperties) => Promise<number>;
}

export declare interface TabsAPI {
  on(
    event: 'update-tab',
    listener: (
      tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      details: chrome.tabs.Tab,
    ) => void,
  ): this;
  on(
    event: 'activate-tab',
    listener: (tabId: number, windowId: number) => void,
  ): this;
  on(event: string, listener: Function): this;
}

export class TabsAPI extends EventEmitter implements ITabsEvents {
  private tabs: Set<Tab> = new Set();
  private tabDetailsCache: Map<Tab, chrome.tabs.Tab> = new Map();

  constructor() {
    super();

    ipcMain.handle('tabs.get', (e, tabId) => this.get(tabId));
    ipcMain.handle('tabs.query', (e, info) => this.query(info));
    ipcMain.handle('tabs.update', (e, tabId, info) => this.update(tabId, info));
    ipcMain.handle('tabs.reload', (e, tabId, props) =>
      this.reload(tabId, props),
    );
    ipcMain.handle('tabs.create', (e, info) => this.create(info));
    ipcMain.handle('tabs.insertCSS', this.insertCSS);
  }

  onCreateTabDetails: (tab: Tab, details: chrome.tabs.Tab) => void;
  onCreateTab: (details: chrome.tabs.CreateProperties) => Promise<number>;

  public getTabById(id: number) {
    return Array.from(this.tabs).find((x) => x.id === id);
  }

  public async update(
    tabId: number,
    updateProperties: chrome.tabs.UpdateProperties,
  ) {
    const tab = this.getTabById(tabId);
    if (!tab) return null;

    const { url, muted, active } = updateProperties;

    // TODO: validate URL, prevent 'javascript:'
    if (url) await tab.loadURL(url);

    if (typeof muted === 'boolean') tab.setAudioMuted(muted);

    if (active) this.activateTab(tabId);

    this.emitOnUpdated(tab.id);

    return this.createTabDetails(tab);
  }

  public activateTab(tabId: number) {
    const tab = this.getTabById(tabId);
    if (!tab) return;

    const win = getParentWindowOfTab(tab);

    let activeChanged = true;

    this.tabDetailsCache.forEach((tabInfo, cacheTab) => {
      if (cacheTab.id === tabId) activeChanged = !tabInfo.active;
      tabInfo.active = tabId === cacheTab.id;
    });

    if (!activeChanged) return;

    this.emit('activate-tab', tab.id, win.id);
    sendToHosts('tabs.onActivated', {
      tabId,
      windowId: win.id,
    });
  }

  public emitOnUpdated(tabId: number) {
    const tab = this.getTabById(tabId);
    if (!tab) return;

    type DetailsType = chrome.tabs.Tab & { [key: string]: string };

    const prevDetails: DetailsType = this.tabDetailsCache.get(tab) as any;
    if (!prevDetails) return;

    const details: DetailsType = this.createTabDetails(tab) as any;

    const compareProps = [
      'status',
      'url',
      'pinned',
      'audible',
      'discarded',
      'autoDiscardable',
      'mutedInfo',
      'favIconUrl',
      'title',
    ];

    let didUpdate = false;
    const changeInfo: any = {};

    for (const prop of compareProps) {
      if (details[prop] !== prevDetails[prop]) {
        changeInfo[prop] = details[prop];
        didUpdate = true;
      }
    }

    if (!didUpdate) return;

    this.emit('update-tab', tab.id, changeInfo, details);
    sendToHosts('tabs.onUpdated', tab.id, changeInfo, details);
  }

  public get(tabId: number) {
    const tab = this.getTabById(tabId);
    return this.getTabDetails(tab);
  }

  public query(info: chrome.tabs.QueryInfo = {}) {
    const isSet = (value: any) => typeof value !== 'undefined';

    const filteredTabs = Array.from(this.tabs)
      .map(this.getTabDetails)
      .filter((tab) => {
        if (isSet(info.active) && info.active !== tab.active) return false;
        if (isSet(info.pinned) && info.pinned !== tab.pinned) return false;
        if (isSet(info.audible) && info.audible !== tab.audible) return false;
        if (isSet(info.muted) && info.muted !== tab.mutedInfo.muted)
          return false;
        if (isSet(info.highlighted) && info.highlighted !== tab.highlighted)
          return false;
        if (isSet(info.discarded) && info.discarded !== tab.discarded)
          return false;
        if (
          isSet(info.autoDiscardable) &&
          info.autoDiscardable !== tab.autoDiscardable
        )
          return false;
        if (isSet(info.status) && info.status !== tab.status) return false;
        if (isSet(info.windowId) && info.windowId !== tab.windowId)
          return false;
        if (isSet(info.title) && info.title !== tab.title) return false; // TODO: pattern match
        if (
          isSet(info.url) &&
          info.url !== tab.url &&
          info.url !== '<all_urls>'
        )
          return false; // TODO: match URL pattern
        // if (isSet(info.currentWindow)) return false
        // if (isSet(info.lastFocusedWindow)) return false
        // if (isSet(info.windowType) && info.windowType !== tab.windowType) return false
        // if (isSet(info.index) && info.index !== tab.index) return false
        return true;
      })
      .map((tab, index) => {
        tab.index = index;
        return tab;
      });

    return filteredTabs;
  }

  public create = async (
    details: chrome.tabs.CreateProperties,
  ): Promise<chrome.tabs.Tab> => {
    if (this.onCreateTab) {
      const tabId = await this.onCreateTab(details);
      const tab = this.getTabById(tabId);
      return this.getTabDetails(tab);
    }

    return this.getTabDetails(null);
  };

  public observe(tab: Tab) {
    this.tabs.add(tab);

    tab.once('destroyed', () => {
      this.tabs.delete(tab);
    });

    const updateEvents: any[] = [
      'page-title-updated', // title
      'did-start-loading', // status
      'did-stop-loading', // status
      'media-started-playing', // audible
      'media-paused', // audible
      'did-start-navigation', // url
      'did-redirect-navigation', // url
      'did-navigate-in-page', // url
    ];

    updateEvents.forEach((eventName) => {
      tab.on(eventName, () => {
        this.emitOnUpdated(tab.id);
      });
    });

    tab.on('page-favicon-updated', (event, favicons) => {
      tab.favicon = favicons[0];
      this.emitOnUpdated(tab.id);
    });
  }

  public reload(
    tabId: number,
    reloadProperties: chrome.tabs.ReloadProperties = {},
  ) {
    const tab = this.getTabById(tabId);
    if (!tab) return;

    if (reloadProperties.bypassCache) {
      tab.reloadIgnoringCache();
    } else {
      tab.reload();
    }
  }

  private insertCSS = async (
    e: Electron.IpcMainEvent,
    extensionId: string,
    tabId: number,
    details: chrome.tabs.InjectDetails,
  ) => {
    const tab = this.getTabById(tabId);
    if (!tab) return;

    if (details.hasOwnProperty('file')) {
      const ses = sessionFromIpcEvent(e);
      details.code = await promises.readFile(
        resolve(ses.getExtension(extensionId).path, details.file),
        'utf8',
      );
    }

    tab.insertCSS(details.code, {
      cssOrigin: details.cssOrigin,
    });
  };

  private createTabDetails(tab: Tab) {
    const window = getParentWindowOfTab(tab);
    const [width = 0, height = 0] = window ? window.getSize() : [];

    const details: chrome.tabs.Tab = {
      active: false,
      audible: tab.isCurrentlyAudible(),
      autoDiscardable: true,
      discarded: false,
      favIconUrl: tab.favicon || undefined,
      height,
      highlighted: false,
      id: tab.id,
      incognito: false,
      index: 0,
      mutedInfo: { muted: tab.audioMuted },
      pinned: false,
      selected: false,
      status: tab.isLoading() ? 'loading' : 'complete',
      title: tab.getTitle(),
      url: tab.getURL(),
      width,
      windowId: window ? window.id : -1,
    };

    if (this.onCreateTabDetails) this.onCreateTabDetails(tab, details);

    this.tabDetailsCache.set(tab, details);

    return details;
  }

  private getTabDetails = (tab: Tab): chrome.tabs.Tab => {
    if (!tab) return { id: -1 } as any;

    if (this.tabDetailsCache.has(tab)) {
      return this.tabDetailsCache.get(tab);
    }

    return this.createTabDetails(tab);
  };
}
