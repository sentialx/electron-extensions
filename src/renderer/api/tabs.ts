import { remote, ipcRenderer } from 'electron';
import { readFileSync } from 'fs';
import { join } from 'path';

import { IpcEvent } from './events/ipc-event';
import { makeId } from '../../utils/string';
import { IpcExtension } from '../../models/ipc-extension';

export const getTabs = (extension: IpcExtension, sessionId: number) => {
  const tabs = {
    onCreated: new IpcEvent('tabs', 'onCreated'),
    onUpdated: new IpcEvent('tabs', 'onUpdated'),
    onActivated: new IpcEvent('tabs', 'onActivated'),
    onRemoved: new IpcEvent('tabs', 'onRemoved'),

    get: (tabId: number, callback: (tab: chrome.tabs.Tab) => void) => {
      tabs.query({}, tabs => {
        callback(tabs.find(x => x.id === tabId));
      });
    },

    getCurrent: (callback: (tab: chrome.tabs.Tab) => void) => {
      tabs.get(remote.getCurrentWebContents().id, tab => {
        callback(tab);
      });
    },

    query: (
      queryInfo: chrome.tabs.QueryInfo,
      callback: (tabs: chrome.tabs.Tab[]) => void,
    ) => {
      ipcRenderer.send(`api-tabs-query-${sessionId}`);

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
      const responseId = makeId(32);
      ipcRenderer.send(
        `api-tabs-create-${sessionId}`,
        responseId,
        createProperties,
      );

      if (callback) {
        ipcRenderer.once(
          `api-tabs-create-${responseId}`,
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

        ipcRenderer.send(`api-tabs-insertCSS-${sessionId}`, tabId, details);

        ipcRenderer.once('api-tabs-insertCSS', () => {
          if (callback) {
            callback();
          }
        });
      };

      if (typeof args[0] === 'object') {
        tabs.getCurrent(tab => {
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
        ipcRenderer.send(`api-tabs-executeScript-${sessionId}`, {
          tabId,
          details,
          responseId,
          extensionId: extension.path,
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
        tabs.getCurrent(tab => {
          if (tab) {
            executeScript(tab.id, args[0], args[1]);
          }
        });
      } else if (typeof args[0] === 'number') {
        executeScript(args[0], args[1], args[2]);
      }
    },

    setZoom: (tabId: number, zoomFactor: number, callback: () => void) => {
      ipcRenderer.send(`api-tabs-setZoom-${sessionId}`, tabId, zoomFactor);

      ipcRenderer.once('api-tabs-setZoom', () => {
        if (callback) {
          callback();
        }
      });
    },

    getZoom: (tabId: number, callback: (zoomFactor: number) => void) => {
      ipcRenderer.send(`api-tabs-getZoom-${sessionId}`, tabId);

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
      ipcRenderer.send(`api-tabs-detectLanguage-${sessionId}`, tabId);

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
  };

  return tabs;
};
