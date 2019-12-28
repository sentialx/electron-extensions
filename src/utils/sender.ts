import { ipcRenderer } from 'electron';

export const getSenderTab = (sessionId: number) =>
  ipcRenderer.sendSync(`current-webcontents-to-tab-${sessionId}`);

export const getSenderContent = (
  id: string,
  sessionId: number,
): chrome.runtime.MessageSender => ({
  id,
  url: window.location.href,
  frameId: 0,
  tab: getSenderTab(sessionId),
});

export const getSender = (id: string): chrome.runtime.MessageSender => ({
  id,
});
