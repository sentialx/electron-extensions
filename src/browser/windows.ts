import { ipcMain, BrowserWindow } from 'electron';
import { EventEmitter } from 'events';
import { Extensions } from '.';
import { isBackgroundPage } from '../utils/web-contents';
import { WINDOW_ID_CURRENT } from '../constants';
import { sendToExtensionPages } from './background-pages';

// Events which can be registered only once
interface IWindowsEvents {
  onCreateDetails: (
    window: BrowserWindow,
    details: chrome.windows.Window,
  ) => void;
  onCreate: (details: chrome.windows.CreateData) => Promise<number>;
}

export class WindowsAPI extends EventEmitter implements IWindowsEvents {
  private windows: Set<BrowserWindow> = new Set();

  private detailsCache: Map<BrowserWindow, chrome.windows.Window> = new Map();

  constructor() {
    super();

    ipcMain.handle('windows.create', (e, details) => this.create(details));
    ipcMain.handle('windows.get', (e, id, details) =>
      id === WINDOW_ID_CURRENT
        ? this.getCurrent(e, details)
        : this.get(id, details),
    );
    ipcMain.handle('windows.getCurrent', this.getCurrent);
    ipcMain.handle('windows.getAll', (e, details) => this.getAll(details));
  }

  onCreateDetails: (
    window: BrowserWindow,
    details: chrome.windows.Window,
  ) => void;
  onCreate: (details: chrome.windows.CreateData) => Promise<number>;

  public observe(window: BrowserWindow) {
    this.windows.add(window);

    window.once('closed', () => {
      this.windows.delete(window);
      this.onRemoved(window);
    });

    this.onCreated(window);
  }

  public getWindowById(id: number) {
    return Array.from(this.windows).find((x) => x.id === id);
  }

  public async create(
    details: chrome.windows.CreateData,
  ): Promise<chrome.windows.Window> {
    if (!this.onCreate) {
      throw new Error('No onCreate event handler');
    }

    const id = await this.onCreate(details);
    const win = this.getWindowById(id);
    return this.getDetails(win);
  }

  public get(
    id: number,
    getInfo: chrome.windows.GetInfo,
  ): chrome.windows.Window {
    const win = this.getWindowById(id);
    return this.getDetailsMatchingGetInfo(win, getInfo);
  }

  public getAll(getInfo: chrome.windows.GetInfo): chrome.windows.Window[] {
    return Array.from(this.windows)
      .map((win) => this.getDetailsMatchingGetInfo(win, getInfo))
      .filter(Boolean);
  }

  private getCurrent = (
    event: Electron.IpcMainInvokeEvent,
    getInfo: chrome.windows.GetInfo,
  ): Partial<chrome.windows.Window> => {
    const tab = Extensions.instance.tabs.getTabById(event.sender.id);

    if (!tab) {
      if (isBackgroundPage(event.sender)) {
        // TODO(sentialx): return last focused window.
      }
      return null;
    }

    const tabDetails = Extensions.instance.tabs.getDetails(tab);
    const win = this.getWindowById(tabDetails.windowId);

    return this.getDetailsMatchingGetInfo(win, getInfo);
  };

  private createDetails(win: BrowserWindow): chrome.windows.Window {
    const { x, y, width, height } = win.getBounds();

    let state = 'normal';

    if (win.isFullScreen()) state = 'fullscreen';
    else if (win.isMaximized()) state = 'maximized';
    else if (win.isMinimized()) state = 'minimized';

    const details: chrome.windows.Window = {
      id: win.id,
      focused: win.isFocused(),
      top: y,
      left: x,
      width,
      height,
      incognito: false,
      type: 'normal',
      state,
      alwaysOnTop: win.isAlwaysOnTop(),
    };

    if (this.onCreateDetails) this.onCreateDetails(win, details);

    this.detailsCache.set(win, details);

    return details;
  }

  private getDetails = (win: BrowserWindow): chrome.windows.Window => {
    if (!win) return null;

    if (this.detailsCache.has(win)) {
      return this.detailsCache.get(win);
    }

    return this.createDetails(win);
  };

  private getDetailsMatchingGetInfo = (
    win: BrowserWindow,
    getInfo: chrome.windows.GetInfo,
  ): chrome.windows.Window => {
    if (!win) return null;

    const details = this.getDetails(win);

    let windowTypes = getInfo?.windowTypes;

    if (!Array.isArray(windowTypes)) {
      windowTypes = ['normal', 'popup'];
    }

    if (!windowTypes.includes(details.type)) return null;

    if (getInfo?.populate === true) {
      return {
        ...details,
        tabs: Extensions.instance.tabs.query({ windowId: win.id }),
      };
    }

    return details;
  };

  private onRemoved(win: BrowserWindow) {
    sendToExtensionPages('windows.onRemoved', {
      windowId: win.id,
    });
  }

  private onCreated(win: BrowserWindow) {
    const details = this.getDetails(win);
    sendToExtensionPages('windows.onCreated', details);
  }
}
