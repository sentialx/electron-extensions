import { ipcRenderer } from 'electron';

import { IpcExtension } from '../models/ipc-extension';
import { IpcEvent } from '../models/ipc-event';
import { makeId } from '../utils/string';

export const getBrowserAction = (
  extension: IpcExtension,
  sessionId: number,
) => ({
  onClicked: new IpcEvent('browserAction', 'onClicked', sessionId),

  setIcon: (details: chrome.browserAction.TabIconDetails, cb: any) => {
    if (cb) cb();
  },

  setBadgeBackgroundColor: (
    details: chrome.browserAction.BadgeBackgroundColorDetails,
    cb: any,
  ) => {
    if (cb) cb();
  },

  setBadgeText: async (
    details: chrome.browserAction.BadgeTextDetails,
    cb: any,
  ) => {
    await ipcRenderer.invoke(
      `api-browserAction-setBadgeText-${sessionId}`,
      extension.id,
      details,
    );

    if (cb) {
      cb();
    }
  },
});
