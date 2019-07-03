import { ipcRenderer } from 'electron';

import { IpcExtension } from '../../models/ipc-extension';
import { IpcEvent } from './events/ipc-event';

export const getBrowserAction = (extension: IpcExtension) => ({
  onClicked: new IpcEvent('browserAction', 'onClicked'),

  setIcon: (details: chrome.browserAction.TabIconDetails, cb: any) => {
    if (cb) cb();
  },

  setBadgeBackgroundColor: (
    details: chrome.browserAction.BadgeBackgroundColorDetails,
    cb: any,
  ) => {
    if (cb) cb();
  },

  setBadgeText: (details: chrome.browserAction.BadgeTextDetails, cb: any) => {
    ipcRenderer.send('api-browserAction-setBadgeText', extension.id, details);

    if (cb) {
      ipcRenderer.once('api-browserAction-setBadgeText', () => {
        cb();
      });
    }
  },
});
