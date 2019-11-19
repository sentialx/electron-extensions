import { ipcRenderer } from 'electron';

export const getSenderTab = () =>
  ipcRenderer.sendSync('current-webcontents-to-tab');

export const getSenderContent = (id: string): chrome.runtime.MessageSender => ({
  id,
  url: window.location.href,
  frameId: 0,
  tab: getSenderTab(),
});

export const getSender = (id: string): chrome.runtime.MessageSender => ({
  id,
});
