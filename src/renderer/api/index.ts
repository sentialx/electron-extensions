import { Alarms } from './alarms';
import { Runtime } from './runtime';
import { IpcExtension } from '~/models';
import { WebNavigation } from './web-navigation';
import { Extension } from './extension';
import { Tabs } from './tabs';
import { WebRequest } from './web-request';
import { I18n } from './i18n';
import { BrowserAction } from './browser-action';
import { Storage } from './storage';
import { ipcRenderer, remote } from 'electron';
import { Port } from './models/port';

export * from './events/api-event';
export * from './events/ipc-event';
export * from './events/web-request-event';
export * from './models/port';

// https://developer.chrome.com/extensions/api_index

export class API {
  public _extension: IpcExtension;

  public runtime: Runtime;
  public webNavigation: WebNavigation;
  public alarms: Alarms;
  public storage: Storage;
  public extension: Extension;
  public tabs: Tabs;
  public webRequest: WebRequest;
  public i18n: I18n;
  public browserAction: BrowserAction;

  // tslint:disable-next-line
  constructor(extension: IpcExtension, tabId: number) {
    this._extension = extension;

    this.runtime = new Runtime(this, tabId);
    this.webNavigation = new WebNavigation();
    this.alarms = new Alarms(this);
    this.storage = new Storage(this);
    this.extension = new Extension();
    this.tabs = new Tabs(this, tabId);
    this.webRequest = new WebRequest();
    this.i18n = new I18n(this);
    this.browserAction = new BrowserAction(this);
  }
}

export const getAPI = (extension: IpcExtension, tabId: number = null) => {
  const api = new API(extension, tabId);

  ipcRenderer.on(
    'api-runtime-connect',
    (e: Electron.IpcMessageEvent, data: any) => {
      const { portId, sender, name } = data;
      const port = new Port(portId, name, sender);
      api.runtime.onConnect.emit(port);
    },
  );

  ipcRenderer.on(
    'api-runtime-sendMessage',
    (e: Electron.IpcMessageEvent, data: any, webContentsId: number) => {
      const { portId, sender, message } = data;

      const sendResponse = (msg: any) => {
        remote.webContents
          .fromId(webContentsId)
          .send(`api-runtime-sendMessage-response-${portId}`, msg);
      };

      api.runtime.onMessage.emit(message, sender, sendResponse);
    },
  );

  return api;
};
