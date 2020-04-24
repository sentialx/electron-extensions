import { IpcEvent } from '../models/ipc-event';
import { ipcInvoker } from './ipc-invoker';
import { BROWSER_ACTION_METHODS } from '../interfaces/browser-action';
import { WINDOW_ID_NONE, WINDOW_ID_CURRENT, TAB_ID_NONE } from '../constants';
import { WebRequestEvent } from '../models/web-request-event';

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

  const contextMenus = {
    onClicked: new IpcEvent('contextMenus.onClicked'),
    create: ipcInvoker('contextMenus.create', { noop: true }),
    removeAll: ipcInvoker('contextMenus.removeAll', { noop: true }),
    remove: ipcInvoker('contextMenus.remove', { noop: true }),
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

  class PolicyConfig {
    get() {}
    set() {}
    clear() {}
  }

  const privacy = {
    network: {
      networkPredictionEnabled: new PolicyConfig(),
      webRTCIPHandlingPolicy: new PolicyConfig(),
      webRTCMultipleRoutesEnabled: new PolicyConfig(),
      webRTCNonProxiedUdpEnabled: new PolicyConfig(),
    },
    websites: {
      hyperlinkAuditingEnabled: new PolicyConfig(),
    },
  };

  const webRequest = {
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
    onAuthRequired: new WebRequestEvent('onAuthRequired'),
  };

  const webNavigation = {
    onBeforeNavigate: new IpcEvent('webNavigation.onBeforeNavigate'),
    onCompleted: new IpcEvent('webNavigation.onCompleted'),
    onCreatedNavigationTarget: new IpcEvent(
      'webNavigation.onCreatedNavigationTarget',
    ),
    onCommitted: new IpcEvent('webNavigation.onCommitted'),
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
    contextMenus,
    webNavigation,
    webRequest,
    privacy,
  });

  if (manifest.browser_action) {
    chrome.browserAction = browserAction;
  }

  if (chrome.storage) {
    chrome.storage.sync = chrome.storage.local;
  }
};
