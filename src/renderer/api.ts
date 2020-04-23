import { IpcEvent } from '../models/ipc-event';
import { ipcInvoker } from './ipc-invoker';
import { BROWSER_ACTION_METHODS } from '../interfaces/browser-action';
import { WINDOW_ID_NONE, WINDOW_ID_CURRENT, TAB_ID_NONE } from '../constants';

declare const chrome: any;

export const injectAPI = () => {
  const manifest = chrome.runtime.getManifest();

  const tabs = {
    ...chrome.tabs,
    TAB_ID_NONE,
    getCurrent: ipcInvoker('tabs.getCurrent'),
    create: ipcInvoker('tabs.create'),
    get: ipcInvoker('tabs.get'),
    remove: ipcInvoker('tabs.remove'),
    getAllInWindow: ipcInvoker('tabs.getAllInWindow'),
    getSelected: ipcInvoker('tabs.getSelected'),
    insertCSS: ipcInvoker('tabs.insertCSS'),
    query: ipcInvoker('tabs.query'),
    reload: ipcInvoker('tabs.reload'),
    update: ipcInvoker('tabs.update'),
    onCreated: new IpcEvent('tabs.onCreated'),
    onRemoved: new IpcEvent('tabs.onRemoved'),
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
    WINDOW_ID_NONE,
    WINDOW_ID_CURRENT,
    get: ipcInvoker('windows.get'),
    getAll: ipcInvoker('windows.getAll'),
    getCurrent: ipcInvoker('windows.getCurrent'),
    getLastFocused: ipcInvoker('windows.getLastFocused'), // TODO
    create: ipcInvoker('windows.create'),
    update: ipcInvoker('windows.update'), // TODO
    remove: ipcInvoker('windows.remove'), // TODO
    onCreated: new IpcEvent('windows.onCreated'),
    onRemoved: new IpcEvent('windows.onRemoved'),
    onFocusChanged: new IpcEvent('windows.onFocusChanged'), // TODO
  };

  const extension = {
    ...chrome.extension,
    getViews: (): any[] => [],
    isAllowedFileSchemeAccess: (cb: any) => cb && cb(false),
    isAllowedIncognitoAccess: (cb: any) => cb && cb(false),
  };

  const notifications = {
    create() {},
    update() {},
    clear() {},
    getAll() {},
    getPermissionLevel() {},
    onClosed: new IpcEvent('notifications.onClosed'),
    onClicked: new IpcEvent('notifications.onClicked'),
    onButtonClicked: new IpcEvent('notifications.onButtonClicked'),
    onPermissionLevelChanged: new IpcEvent(
      'notifications.onPermissionLevelChanged',
    ),
    onShowSettings: new IpcEvent('notifications.onShowSettings'),
  };

  const permissions = {
    onAdded: new IpcEvent('permissions.onAdded'),
    getAll: () => {},
  };

  const browserAction: any = {
    onClicked: new IpcEvent('browserAction.onClicked'),
  };

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

  Object.assign(chrome, {
    tabs,
    cookies,
    windows,
    extension,
    notifications,
    permissions,
  });

  if (manifest.browser_action) {
    chrome.browserAction = browserAction;
  }

  if (chrome.storage) {
    chrome.storage.sync = chrome.storage.local;
  }
};
