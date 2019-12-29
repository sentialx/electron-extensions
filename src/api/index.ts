import { ipcRenderer, session } from 'electron';
import { Port } from '../models/port';
import { IpcExtension } from '../models/ipc-extension';
import { IpcEvent } from '../models/ipc-event';
import { getStorage } from './storage';
import { getTabs } from './tabs';
import { getRuntime } from './runtime';
import { getI18n } from './i18n';
import { getBrowserAction } from './browser-action';
import { getWebRequest } from './web-request';
import { getWebNavigation } from './web-navigation';
import { cookies } from './cookies';

const arg = process.argv.find(x => x.startsWith('--window-id='));

let windowId: number = null;

if (arg) {
  windowId = parseInt(arg.split('--window-id=')[1], 10);
}

export const getAPI = (extension: IpcExtension, sessionId: number) => {
  const api = {
    runtime: getRuntime(extension, sessionId),
    storage: getStorage(extension.id, sessionId),
    tabs: getTabs(extension, sessionId, windowId),
    i18n: getI18n(extension),
    browserAction: getBrowserAction(extension, sessionId),
    webRequest: getWebRequest(),
    webNavigation: getWebNavigation(),
    cookies: cookies(extension, sessionId),

    alarms: {
      onAlarm: new IpcEvent('alarms', 'onAlarm', sessionId),
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
      getURL: getRuntime(extension, sessionId).getURL,
      isAllowedIncognitoAccess: (cb: any) => {
        if (cb) cb(false);
      },
    },

    contextMenus: {
      onClicked: new IpcEvent('contextMenus', 'onClicked', sessionId),
      create: () => {},
      removeAll: () => {},
    },

    windows: {
      get: () => {},
      onFocusChanged: new IpcEvent('windows', 'onFocusChanged', sessionId),
    },

    management: {
      getSelf: (cb: any) => {
        if (cb) cb({ installType: 'normal' });
      },
      getAll: (cb: any) => {
        if (cb) {
          cb(
            Object.values(
              ipcRenderer.sendSync(`get-extensions-${sessionId}`),
            ).map(x => ({ installType: 'normal' })),
          );
        }
      },
    },

    privacy: {
      network: {
        networkPredictionEnabled: {
          set: () => {},
          clear: () => {},
        },
        webRTCMultipleRoutesEnabled: {},
        webRTCNonProxiedUdpEnabled: {},
        webRTCIPHandlingPolicy: {},
      },
      websites: {
        hyperlinkAuditingEnabled: {
          set: () => {},
          clear: () => {},
        },
      },
    },
  };

  ipcRenderer.on('api-runtime-connect', (e, data: any) => {
    const { portId, sender, name } = data;
    const port = new Port(sessionId, portId, name, sender);

    api.runtime.onConnect.emit(port);
  });

  ipcRenderer.on(
    'api-runtime-sendMessage',
    (e, data: any, webContentsId: number) => {
      const { portId, sender, message } = data;

      const sendResponse = (msg: any) => {
        ipcRenderer.send(
          'send-msg-webcontents',
          webContentsId,
          `api-runtime-sendMessage-response-${portId}`,
          msg,
        );
      };

      api.runtime.onMessage.emit(message, sender, sendResponse);
    },
  );

  ipcRenderer.on(
    'api-tabs-sendMessage',
    (e, data: any, webContentsId: number) => {
      const { portId, sender, message } = data;

      const sendResponse = (msg: any) => {
        ipcRenderer.send(
          'send-msg-webcontents',
          webContentsId,
          `api-tabs-sendMessage-response-${portId}`,
          msg,
        );
      };

      api.runtime.onMessage.emit(message, sender, sendResponse);
    },
  );

  return api;
};
