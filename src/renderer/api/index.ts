import { ipcRenderer, remote } from 'electron';
import { Port } from '../../models/port';
import { IpcExtension } from '../../models/ipc-extension';
import { LocalEvent } from './events/local-event';
import { makeId, replaceAll } from '../../utils/string';
import { format } from 'url';
import { IpcEvent } from './events/ipc-event';
import { readFileSync } from 'fs';
import { join } from 'path';
import { WebRequestEvent } from './events/web-request-event';

const getSender = (id: string): chrome.runtime.MessageSender => ({
  id,
  url: window.location.href,
  frameId: 0,
  tab: { id: remote.getCurrentWebContents().id } as any,
});

const sendStorageOperation = (
  extensionId: string,
  arg: any,
  area: string,
  type: string,
  callback: any,
) => {
  const id = makeId(32);
  ipcRenderer.send('api-storage-operation', {
    extensionId,
    id,
    arg,
    type,
    area,
  });

  if (callback) {
    ipcRenderer.once(
      `api-storage-operation-${id}`,
      (e: any, ...data: any[]) => {
        callback(data[0]);
      },
    );
  }
};

const getStorageArea = (id: string, area: string) => ({
  set: (arg: any, cb: any) => sendStorageOperation(id, arg, area, 'set', cb),
  get: (arg: any, cb: any) => sendStorageOperation(id, arg, area, 'get', cb),
  remove: (arg: any, cb: any) =>
    sendStorageOperation(id, arg, area, 'remove', cb),
  clear: (arg: any, cb: any) =>
    sendStorageOperation(id, arg, area, 'clear', cb),
});

export const getAPI = (extension: IpcExtension) => {
  const api = {
    runtime: {
      lastError: null as any,
      id: extension.id,
      onConnect: new LocalEvent(),
      onMessage: new LocalEvent(),

      sendMessage: (...args: any[]) => {
        const sender = getSender(api.runtime.id);
        const portId = makeId(32);

        let extensionId = args[0];
        let message = args[1];
        let options = args[2];
        let responseCallback = args[3];

        if (typeof args[0] === 'object') {
          message = args[0];
          extensionId = api.runtime.id;
        }

        if (typeof args[1] === 'object') {
          options = args[1];
        }

        if (typeof args[1] === 'function') {
          responseCallback = args[1];
        }

        if (typeof args[2] === 'function') {
          responseCallback = args[2];
        }

        if (options && options.includeTlsChannelId) {
          sender.tlsChannelId = portId;
        }

        if (typeof responseCallback === 'function') {
          ipcRenderer.on(
            `api-runtime-sendMessage-response-${portId}`,
            (e: Electron.IpcMessageEvent, res: any) => {
              responseCallback(res);
            },
          );
        }

        ipcRenderer.send('api-runtime-sendMessage', {
          extensionId,
          portId,
          sender,
          message,
        });
      },

      connect: (...args: any[]) => {
        const sender = getSender(api.runtime.id);
        const portId = makeId(32);

        let name: string = null;
        let extensionId: string = api.runtime.id;

        if (typeof args[0] === 'string') {
          extensionId = args[0];

          if (args[1] && typeof args[1] === 'object') {
            if (args[1].includeTlsChannelId) {
              sender.tlsChannelId = portId;
            }
            name = args[1].name;
          }
        } else if (args[0] && typeof args[0] === 'object') {
          if (args[0].includeTlsChannelId) {
            sender.tlsChannelId = portId;
          }
          name = args[0].name;
        }

        ipcRenderer.send('api-runtime-connect', {
          extensionId,
          portId,
          sender,
          name,
        });

        return new Port(portId, name);
      },

      reload: () => {
        ipcRenderer.send('api-runtime-reload', api.runtime.id);
      },

      getURL: (path: string) =>
        format({
          protocol: 'electron-extension',
          slashes: true,
          hostname: api.runtime.id,
          pathname: path,
        }),

      getManifest: () => extension.manifest,
    },
    webNavigation: {
      onBeforeNavigate: new IpcEvent('webNavigation', 'onBeforeNavigate'),
      onCommitted: new IpcEvent('webNavigation', 'onCommitted'),
      onDOMContentLoaded: new IpcEvent('webNavigation', 'onDOMContentLoaded'),
      onCompleted: new IpcEvent('webNavigation', 'onCompleted'),
      onCreatedNavigationTarget: new IpcEvent(
        'webNavigation',
        'onCreatedNavigationTarget',
      ),
      onReferenceFragmentUpdated: new IpcEvent(
        'webNavigation',
        'onReferenceFragmentUpdated',
      ), // TODO
      onTabReplaced: new IpcEvent('webNavigation', 'onTabReplaced'), // TODO
      onHistoryStateUpdated: new IpcEvent(
        'webNavigation',
        'onHistoryStateUpdated',
      ), // TODO
    },
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
    storage: {
      local: getStorageArea(extension.id, 'local'),
      managed: getStorageArea(extension.id, 'managed'),
    },
    extension: {
      isIncognitoContext: false,
    },
    tabs: {
      onCreated: new IpcEvent('tabs', 'onCreated'),
      onUpdated: new IpcEvent('tabs', 'onUpdated'),
      onActivated: new IpcEvent('tabs', 'onActivated'),
      onRemoved: new IpcEvent('tabs', 'onRemoved'),

      get: (tabId: number, callback: (tab: chrome.tabs.Tab) => void) => {
        api.tabs.query({}, tabs => {
          callback(tabs.find(x => x.id === tabId));
        });
      },

      getCurrent: (callback: (tab: chrome.tabs.Tab) => void) => {
        api.tabs.get(remote.getCurrentWebContents().id, tab => {
          callback(tab);
        });
      },

      query: (
        queryInfo: chrome.tabs.QueryInfo,
        callback: (tabs: chrome.tabs.Tab[]) => void,
      ) => {
        ipcRenderer.send('api-tabs-query');

        ipcRenderer.once(
          'api-tabs-query',
          (e: Electron.IpcMessageEvent, data: chrome.tabs.Tab[]) => {
            const readProperty = (obj: any, prop: string) => obj[prop];

            callback(
              data.filter(tab => {
                for (const key in queryInfo) {
                  const tabProp = readProperty(tab, key);
                  const queryInfoProp = readProperty(queryInfo, key);

                  if (key === 'url' && queryInfoProp === '<all_urls>') {
                    return true;
                  }

                  if (tabProp == null || queryInfoProp !== tabProp) {
                    return false;
                  }
                }

                return true;
              }),
            );
          },
        );
      },

      create: (
        createProperties: chrome.tabs.CreateProperties,
        callback: (tab: chrome.tabs.Tab) => void = null,
      ) => {
        ipcRenderer.send('api-tabs-create', createProperties);

        if (callback) {
          ipcRenderer.once(
            'api-tabs-create',
            (e: Electron.IpcMessageEvent, data: chrome.tabs.Tab) => {
              callback(data);
            },
          );
        }
      },

      insertCSS: (...args: any[]) => {
        const insertCSS = (tabId: number, details: any, callback: any) => {
          if (details.hasOwnProperty('file')) {
            details.code = readFileSync(
              join(extension.path, details.file),
              'utf8',
            );
          }

          ipcRenderer.send('api-tabs-insertCSS', tabId, details);

          ipcRenderer.once('api-tabs-insertCSS', () => {
            if (callback) {
              callback();
            }
          });
        };

        if (typeof args[0] === 'object') {
          api.tabs.getCurrent(tab => {
            insertCSS(tab.id, args[0], args[1]);
          });
        } else if (typeof args[0] === 'number') {
          insertCSS(args[0], args[1], args[2]);
        }
      },

      executeScript: (...args: any[]) => {
        const executeScript = (tabId: number, details: any, callback: any) => {
          if (details.hasOwnProperty('file')) {
            details.code = readFileSync(
              join(extension.path, details.file),
              'utf8',
            );
          }

          const responseId = makeId(32);
          ipcRenderer.send('api-tabs-executeScript', {
            tabId,
            details,
            responseId,
            extensionId: api.runtime.id,
          });

          ipcRenderer.once(
            `api-tabs-executeScript-${responseId}`,
            (e: Electron.IpcMessageEvent, result: any) => {
              if (callback) {
                callback(result);
              }
            },
          );
        };

        if (typeof args[0] === 'object') {
          api.tabs.getCurrent(tab => {
            if (tab) {
              executeScript(tab.id, args[0], args[1]);
            }
          });
        } else if (typeof args[0] === 'number') {
          executeScript(args[0], args[1], args[2]);
        }
      },

      setZoom: (tabId: number, zoomFactor: number, callback: () => void) => {
        ipcRenderer.send('api-tabs-setZoom', tabId, zoomFactor);

        ipcRenderer.once('api-tabs-setZoom', () => {
          if (callback) {
            callback();
          }
        });
      },

      getZoom: (tabId: number, callback: (zoomFactor: number) => void) => {
        ipcRenderer.send('api-tabs-getZoom', tabId);

        ipcRenderer.once(
          'api-tabs-getZoom',
          (e: Electron.IpcMessageEvent, zoomFactor: number) => {
            if (callback) {
              callback(zoomFactor);
            }
          },
        );
      },

      detectLanguage: (tabId: number, callback: (language: string) => void) => {
        ipcRenderer.send('api-tabs-detectLanguage', tabId);

        ipcRenderer.once(
          'api-tabs-detectLanguage',
          (e: Electron.IpcMessageEvent, language: string) => {
            if (callback) {
              callback(language);
            }
          },
        );
      },

      update: () => {},
    },
    webRequest: {
      ResourceType: {
        CSP_REPORT: 'csp_report',
        FONT: 'font',
        IMAGE: 'image',
        MAIN_FRAME: 'main_frame',
        MEDIA: 'media',
        OBJECT: 'object',
        OTHER: 'other',
        PING: 'ping',
        SCRIPT: 'script',
        STYLESHEET: 'stylesheet',
        SUB_FRAME: 'sub_frame',
        WEBSOCKET: 'websocket',
        XMLHTTPREQUEST: 'xmlhttprequest',
      },

      onBeforeRequest: new WebRequestEvent('onBeforeRequest'),
      onBeforeSendHeaders: new WebRequestEvent('onBeforeSendHeaders'),
      onHeadersReceived: new WebRequestEvent('onHeadersReceived'),
      onSendHeaders: new WebRequestEvent('onSendHeaders'),
      onResponseStarted: new WebRequestEvent('onResponseStarted'),
      onBeforeRedirect: new WebRequestEvent('onBeforeRedirect'),
      onCompleted: new WebRequestEvent('onCompleted'),
      onErrorOccurred: new WebRequestEvent('onErrorOccurred'),
    },
    i18n: {
      getAcceptLanguages: (cb: any) => {
        if (cb) {
          cb(navigator.languages);
        }
      },
      getMessage: (messageName: string, substitutions?: any) => {
        if (messageName === '@@ui_locale') return 'en_US';

        const { locale } = extension;
        const substitutionsArray = substitutions instanceof Array;

        const item = locale[messageName];

        if (item == null) return '';
        if (substitutionsArray && substitutions.length >= 9) return null;

        let message = item.message;

        if (typeof item.placeholders === 'object') {
          for (const placeholder in item.placeholders) {
            message = replaceAll(
              message,
              `$${placeholder}$`,
              item.placeholders[placeholder].content,
            );
          }
        }

        if (substitutionsArray) {
          for (let i = 0; i < 9; i++) {
            message = replaceAll(message, `$${i + 1}`, substitutions[i] || ' ');
          }
        }

        return message;
      },

      getUILanguage: () => {
        return navigator.language;
      },

      detectLanguage: (text: string, cb: any) => {
        // TODO
        if (cb) {
          cb({
            isReliable: false,
            languages: [],
          });
        }
      },
    },
    browserAction: {
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

      setBadgeText: (
        details: chrome.browserAction.BadgeTextDetails,
        cb: any,
      ) => {
        ipcRenderer.send(
          'api-browserAction-setBadgeText',
          api.runtime.id,
          details,
        );

        if (cb) {
          ipcRenderer.once('api-browserAction-setBadgeText', () => {
            cb();
          });
        }
      },
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
