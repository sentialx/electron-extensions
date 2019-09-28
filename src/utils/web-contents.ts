import { WebContents, webContents } from 'electron';

export const webContentsToTab = (wc: WebContents): chrome.tabs.Tab => ({
  id: wc.id,
  index: wc.id,
  windowId: wc.hostWebContents ? wc.hostWebContents.id : wc.id,
  highlighted: wc.isFocused(),
  active: wc.isFocused(),
  selected: wc.isFocused(),
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
