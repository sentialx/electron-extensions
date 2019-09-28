import { remote } from 'electron';

import { webContentsToTab } from './web-contents';

export const getSenderTab = () =>
  webContentsToTab(remote.getCurrentWebContents());

export const getSenderContent = (id: string): chrome.runtime.MessageSender => ({
  id,
  url: window.location.href,
  frameId: 0,
  tab: getSenderTab(),
});

export const getSender = (id: string): chrome.runtime.MessageSender => ({
  id,
});
