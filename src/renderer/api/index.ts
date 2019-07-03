import { ipcRenderer, remote } from 'electron';
import { Port } from '../../models/port';
import { IpcExtension } from '../../models/ipc-extension';
import { IpcEvent } from './events/ipc-event';
import { getStorage } from './storage';
import { getTabs } from './tabs';
import { getRuntime } from './runtime';
import { getI18n } from './i18n';
import { getBrowserAction } from './browser-action';
import { getWebRequest } from './web-request';
import { getWebNavigation } from './web-navigation';

export const getAPI = (extension: IpcExtension) => {
  const api = {
    runtime: getRuntime(extension),
    storage: getStorage(extension.id),
    tabs: getTabs(extension),
    i18n: getI18n(extension),
    browserAction: getBrowserAction(extension),
    webRequest: getWebRequest(),
    webNavigation: getWebNavigation(),

    alarms: {
      onAlarm: new IpcEvent('alarms', 'onAlarm'),
      create: (
        name: string | chrome.alarms.AlarmCreateInfo,
        alarmInfo: chrome.alarms.AlarmCreateInfo,
      ) => {},
      get: (name: string, cb: any) => {},
      getAll: (cb: any) => {},
      clear: (name: string, cb: any) => {},
      clearAll: (cb: any) => {},
    },

    extension: {
      isIncognitoContext: false,
    },
  };

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
