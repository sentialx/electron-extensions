import { EventEmitter } from 'events';
import { ipcRenderer, IpcMessageEvent, remote } from 'electron';
import { IpcExtension } from '../models/ipc-extension';

let webContentsId = -1;

if (remote) {
  webContentsId = remote.getCurrentWebContents().id;
}

export declare interface ExtensionsRenderer {
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

export class ExtensionsRenderer extends EventEmitter {
  public browserAction = {
    onClicked: (extensionId: string, tabId: number) => {
      ipcRenderer.send(
        `api-browserAction-onClicked-${webContentsId}`,
        extensionId,
        tabId,
      );
    },
  };

  constructor() {
    super();

    if (!ipcRenderer) return;

    ipcRenderer.on(
      'api-tabs-create',
      (
        e: IpcMessageEvent,
        responseId: string,
        details: chrome.tabs.CreateProperties,
      ) => {
        const callback = (id: number) => {
          ipcRenderer.send(`api-tabs-create-${responseId}`, id);
        };

        this.emit('create-tab', details, callback);
      },
    );

    ipcRenderer.on(
      'api-browserAction-setBadgeText',
      (
        e: IpcMessageEvent,
        responseId: string,
        extensionId: string,
        details: chrome.browserAction.BadgeTextDetails,
      ) => {
        this.emit('set-badge-text', extensionId, details);
        ipcRenderer.send(`api-browserAction-setBadgeText-${responseId}`);
      },
    );
  }

  public getExtensions(): { [key: string]: IpcExtension } {
    return ipcRenderer.sendSync(`get-extensions-${webContentsId}`);
  }
}

export const extensionsRenderer = new ExtensionsRenderer();
