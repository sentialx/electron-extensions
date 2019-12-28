import { WebContents, webContents } from 'electron';
import { ExtensibleSession } from '../main';

export const webContentsToTab = (
  wc: WebContents,
  ses: ExtensibleSession,
): chrome.tabs.Tab => ({
  id: wc.id,
  index: wc.id,
  windowId: wc.hostWebContents ? wc.hostWebContents.id : wc.id,
  highlighted: wc.id === ses.activeTab,
  active: wc.id === ses.activeTab,
  selected: wc.id === ses.activeTab,
  pinned: false,
  discarded: false,
  autoDiscardable: false,
  url: wc.getURL(),
  title: wc.getTitle(),
  incognito: false,
  audible: wc.isCurrentlyAudible(),
});

export const getAllWebContentsInSession = (ses: Electron.Session) => {
  return webContents.getAllWebContents().filter(x => x.session === ses);
};

export const webContentsValid = (webContents: WebContents) => {
  const type = webContents.getType();
  return type === 'window' || type === 'webview' || type === 'browserView';
};
