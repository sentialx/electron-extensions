import { WebContents } from 'electron';

import { ExtensibleSession } from '..';
import { sendToBackgroundPages } from '../../utils/extensions';
import { webContentsToTab } from '../../utils/web-contents';

export const hookWebContentsEvents = (
  ses: ExtensibleSession,
  webContents: WebContents,
) => {
  const tabId = webContents.id;

  sendToBackgroundPages(ses, 'api-emit-event-tabs-onCreated');

  webContents.on('will-navigate', (e, url) => {
    sendToBackgroundPages(
      ses,
      'api-emit-event-webNavigation-onBeforeNavigate',
      {
        frameId: 0,
        parentFrameId: -1,
        processId: webContents.getProcessId(),
        tabId,
        timeStamp: Date.now(),
        url,
      },
    );
  });

  webContents.on('did-start-loading', () => {
    const changeInfo = { status: 'loading' };

    sendToBackgroundPages(
      ses,
      'api-emit-event-tabs-onUpdated',
      tabId,
      changeInfo,
      webContentsToTab(webContents, ses),
    );
  });

  webContents.on('did-stop-loading', () => {
    const changeInfo = { status: 'complete' };

    sendToBackgroundPages(
      ses,
      'api-emit-event-tabs-onUpdated',
      tabId,
      changeInfo,
      webContentsToTab(webContents, ses),
    );
  });

  webContents.on(
    'did-start-navigation',
    (e: any, url: string, isMainFrame: boolean) => {
      if (isMainFrame) {
        sendToBackgroundPages(ses, 'api-emit-event-webNavigation-onCommitted', {
          frameId: 0,
          parentFrameId: -1,
          processId: webContents.getProcessId(),
          tabId,
          timeStamp: Date.now(),
          url,
        });
      }
    },
  );

  webContents.on('did-navigate', (e, url) => {
    sendToBackgroundPages(ses, 'api-emit-event-webNavigation-onCompleted', {
      frameId: 0,
      parentFrameId: -1,
      processId: webContents.getProcessId(),
      tabId,
      timeStamp: Date.now(),
      url,
    });
  });

  webContents.once('destroyed', () => {
    sendToBackgroundPages(ses, 'api-emit-event-tabs-onRemoved', tabId);
  });
};
