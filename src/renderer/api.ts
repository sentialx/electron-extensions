import { IpcEvent } from '../models/ipc-event';
import { ipcInvoker } from './ipc-invoker';
import { BROWSER_ACTION_METHODS } from '../interfaces/browser-action';

declare const chrome: any;

export const injectAPI = () => {
  const tabs = {
    ...chrome.tabs,
    getCurrent: ipcInvoker('tabs.getCurrent'),
    create: ipcInvoker('tabs.create'),
    get: ipcInvoker('tabs.get'),
    getAllInWindow: ipcInvoker('tabs.getAllInWindow'), // TODO
    insertCSS: ipcInvoker('tabs.insertCSS'),
    query: ipcInvoker('tabs.query'),
    reload: ipcInvoker('tabs.reload'),
    update: ipcInvoker('tabs.update'),
    onCreated: new IpcEvent('tabs.onCreated'), // TODO
    onRemoved: new IpcEvent('tabs.onRemoved'), // TODO
    onUpdated: new IpcEvent('tabs.onUpdated'),
    onActivated: new IpcEvent('tabs.onActivated'),
  };

  const cookies = {
    get: ipcInvoker('cookies.get'),
    getAll: ipcInvoker('cookies.getAll'),
    remove: ipcInvoker('cookies.remove'),
    set: ipcInvoker('cookies.set'),
    onChanged: new IpcEvent('cookies.onChanged'),
  };

  const windows = {
    ...(chrome.windows || {}),
    get: ipcInvoker('windows.get', { noop: true }), // TODO
    getAll: ipcInvoker('windows.getAll', { noop: true }), // TODO
    create: ipcInvoker('windows.create', { noop: true }), // TODO
    update: ipcInvoker('windows.update', { noop: true }), // TODO
    onFocusChanged: new IpcEvent('windows.onFocusChanged'), // TODO
  };

  const extension = {
    ...chrome.extension,
    isAllowedFileSchemeAccess: (cb: any) => {
      if (cb) cb(false);
    },
    isAllowedIncognitoAccess: (cb: any) => {
      if (cb) cb(false);
    },
  };

  const notifications = {
    onClicked: new IpcEvent('notifications.onClicked'),
    create: () => {},
    clear: () => {},
  };

  const permissions = {
    onAdded: new IpcEvent('permissions.onAdded'),
    getAll: () => {},
  };

  const browserAction: any = {};

  BROWSER_ACTION_METHODS.forEach((method) => {
    browserAction[method] = async (details: any, cb: any) => {
      if (details.imageData) {
        return;
        // TODO(sentialx): convert to buffer
        details.imageData.data = Buffer.from(details.imageData.data);
      }
      if (cb) cb();
    };
  });

  const storage = {
    ...chrome.storage,
    sync: chrome.storage.local,
  };

  Object.assign(chrome, {
    tabs,
    cookies,
    windows,
    extension,
    notifications,
    permissions,
    browserAction,
    storage,
  });
};
