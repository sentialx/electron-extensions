import { ipcRenderer } from 'electron';

import { IpcExtension } from '../../models/ipc-extension';
import { IpcEvent } from './events/ipc-event';
import { makeId } from '../../utils/string';

export const getBrowserAction = (
  extension: IpcExtension,
  sessionId: number,
) => ({
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
    const responseId = makeId(32);

    ipcRenderer.send(
      `api-browserAction-setBadgeText-${sessionId}`,
      responseId,
      extension.id,
      details,
    );

    if (cb) {
      ipcRenderer.once(`api-browserAction-setBadgeText-${responseId}`, () => {
        cb();
      });
    }
  },
});
