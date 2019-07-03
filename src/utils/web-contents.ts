import { WebContents, webContents } from 'electron';

import { sendToBackgroundPages } from './extensions';
import { ExtensibleSession } from '..';

export const webContentsToTab = (wc: WebContents) => ({
  id: wc.id,
  index: wc.id,
  windowId: wc.hostWebContents ? wc.hostWebContents.id : wc.id,
  highlighted: wc.isFocused(),
  active: wc.isFocused(),
  pined: false,
  discarded: false,
  autoDiscardable: false,
  url: wc.getURL(),
  title: wc.getTitle(),
  incognito: false,
});

export const hookWebContentsEvents = (
  ses: ExtensibleSession,
  webContents: WebContents,
) => {
  const tabId = webContents.id;

  sendToBackgroundPages(ses, 'api-tabs-onCreated');

  webContents.on('will-navigate', (e, url) => {
    sendToBackgroundPages(ses, 'api-webNavigation-onBeforeNavigate', {
      frameId: 0,
      parentFrameId: -1,
      processId: webContents.getProcessId(),
      tabId,
      timeStamp: Date.now(),
      url,
    });
  });

  webContents.on('did-start-loading', () => {
    const changeInfo = { status: 'loading' };

    sendToBackgroundPages(
      ses,
      'api-tabs-onUpdated',
      tabId,
      changeInfo,
      webContentsToTab(webContents),
    );
  });

  webContents.on('did-stop-loading', () => {
    const changeInfo = { status: 'complete' };

    sendToBackgroundPages(
      ses,
      'api-tabs-onUpdated',
      tabId,
      changeInfo,
      webContentsToTab(webContents),
    );
  });

  webContents.on('did-navigate', (e, url) => {
    sendToBackgroundPages(ses, 'api-webNavigation-onCompleted', {
      frameId: 0,
      parentFrameId: -1,
      processId: webContents.getProcessId(),
      tabId,
      timeStamp: Date.now(),
      url,
    });
  });

  webContents.once('destroyed', () => {
    sendToBackgroundPages(ses, 'api-tabs-onRemoved', tabId);
  });
};

export const getAllWebContentsInSession = (ses: Electron.Session) => {
  return webContents.getAllWebContents().filter(x => x.session === ses);
};

export const webContentsValid = (webContents: WebContents) => {
  const type = webContents.getType();
  return type === 'window' || type === 'webview' || type === 'browserView';
};
