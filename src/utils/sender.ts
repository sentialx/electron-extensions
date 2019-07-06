import { remote } from 'electron';

import { webContentsToTab } from './web-contents';

export const getSenderTab = (id: string): chrome.runtime.MessageSender => ({
  id,
  url: window.location.href,
  frameId: 0,
  tab: webContentsToTab(remote.getCurrentWebContents()),
});

export const getSender = (id: string): chrome.runtime.MessageSender => ({
  id,
});
