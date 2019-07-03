import { webContents, ipcMain, IpcMessageEvent } from 'electron';
import { getIpcExtension, sendToBackgroundPages } from '../../utils/extensions';
import { ExtensibleSession } from '..';
import {
  getAllWebContentsInSession,
  webContentsToTab,
} from '../../utils/web-contents';
import { makeId } from '../../utils/string';
import { findWindowByWebContents } from '../../utils/windows';

export const runMessagingService = (ses: ExtensibleSession) => {
  ipcMain.on(`get-extension-${ses.id}`, (e: IpcMessageEvent, id: string) => {
    e.returnValue = getIpcExtension(ses.extensions[id]);
  });

  ipcMain.on(`get-extensions-${ses.id}`, (e: IpcMessageEvent) => {
    const list = { ...ses.extensions };

    for (const key in list) {
      list[key] = getIpcExtension(list[key]);
    }

    e.returnValue = list;
  });

  ipcMain.on(`api-tabs-query-${ses.id}`, (e: IpcMessageEvent) => {
    const tabs = getAllWebContentsInSession(ses.session).map(x =>
      webContentsToTab(x),
    );
    e.sender.send('api-tabs-query', tabs);
  });

  ipcMain.on(
    `api-tabs-create-${ses.id}`,
    (
      e: IpcMessageEvent,
      responseId: string,
      data: chrome.tabs.CreateProperties,
    ) => {
      const newId = makeId(32);

      if (data.windowId) {
        const wc = ses.webContents.find(x => x.id === data.windowId);
        wc.send('api-tabs-create', newId, data);
      } else if (e.sender.getType() === 'backgroundPage') {
        ses.lastActiveWebContents.send('api-tabs-create', newId, data);
      } else {
        const wc = findWindowByWebContents(e.sender);
        wc.send('api-tabs-create', newId, data);
      }

      ipcMain.once(`api-tabs-create-${newId}`, (_: any, tabId: number) => {
        e.sender.send(
          `api-tabs-create-${responseId}`,
          webContentsToTab(webContents.fromId(tabId)),
        );
      });
    },
  );

  ipcMain.on(
    `api-tabs-insertCSS-${ses.id}`,
    (e: IpcMessageEvent, tabId: number, details: chrome.tabs.InjectDetails) => {
      const contents = webContents.fromId(tabId);

      if (contents) {
        contents.insertCSS(details.code);
        e.sender.send('api-tabs-insertCSS');
      }
    },
  );

  ipcMain.on(
    `api-tabs-executeScript-${ses.id}`,
    (e: IpcMessageEvent, data: any) => {
      const { tabId, code } = data;
      const contents = webContents.fromId(tabId);

      if (contents) {
        contents.executeJavaScript(data.details.code, false, (result: any) => {
          e.sender.send(`api-tabs-executeScript-${data.responseId}`, result);
        });
      }
    },
  );

  ipcMain.on(
    `api-runtime-reload-${ses.id}`,
    (e: IpcMessageEvent, extensionId: string) => {
      const { backgroundPage } = ses.extensions[extensionId];

      if (backgroundPage) {
        const contents = webContents.fromId(e.sender.id);
        contents.reload();
      }
    },
  );

  ipcMain.on(
    `api-runtime-connect-${ses.id}`,
    async (e: IpcMessageEvent, { extensionId, portId, sender, name }: any) => {
      const { backgroundPage } = ses.extensions[extensionId];
      const { webContents } = backgroundPage;

      if (e.sender.id !== webContents.id) {
        webContents.send('api-runtime-connect', {
          portId,
          sender,
          name,
        });
      }
    },
  );

  ipcMain.on(
    `api-runtime-sendMessage--${ses.id}`,
    async (e: IpcMessageEvent, data: any) => {
      const { extensionId } = data;
      const { backgroundPage } = ses.extensions[extensionId];
      const { webContents } = backgroundPage;

      if (e.sender.id !== webContents.id) {
        webContents.send('api-runtime-sendMessage', data, e.sender.id);
      }
    },
  );

  ipcMain.on(
    `api-port-postMessage-${ses.id}`,
    (e: IpcMessageEvent, { portId, msg }: any) => {
      Object.keys(ses.extensions).forEach(key => {
        const { backgroundPage } = ses.extensions[key];
        const contents = backgroundPage.webContents;

        if (e.sender.id !== contents.id) {
          contents.send(`api-port-postMessage-${portId}`, msg);
        }
      });

      const contents = getAllWebContentsInSession(ses.session);
      for (const content of contents) {
        if (content.id !== e.sender.id) {
          content.send(`api-port-postMessage-${portId}`, msg);
        }
      }
    },
  );

  ipcMain.on(
    `api-storage-operation-${ses.id}`,
    (e: IpcMessageEvent, { extensionId, id, area, type, arg }: any) => {
      const { databases } = ses.extensions[extensionId];

      const contents = webContents.fromId(e.sender.id);
      const msg = `api-storage-operation-${id}`;

      if (type === 'get') {
        databases[area].get(arg, d => {
          for (const key in d) {
            if (Buffer.isBuffer(d[key])) {
              d[key] = JSON.parse(d[key].toString());
            }
          }
          contents.send(msg, d);
        });
      } else if (type === 'set') {
        databases[area].set(arg, () => {
          contents.send(msg);
        });
      } else if (type === 'clear') {
        databases[area].clear(() => {
          contents.send(msg);
        });
      } else if (type === 'remove') {
        databases[area].set(arg, () => {
          contents.send(msg);
        });
      }
    },
  );

  ipcMain.on(
    `api-alarms-operation-${ses.id}`,
    (e: IpcMessageEvent, data: any) => {
      const { extensionId, type } = data;
      const contents = webContents.fromId(e.sender.id);

      if (type === 'create') {
        const extension = ses.extensions[extensionId];
        const { alarms } = extension;

        const { name, alarmInfo } = data;
        const exists = alarms.findIndex(e => e.name === name) !== -1;

        e.returnValue = null;
        if (exists) return;

        let scheduledTime = 0;

        if (alarmInfo.when != null) {
          scheduledTime = alarmInfo.when;
        }

        if (alarmInfo.delayInMinutes != null) {
          if (alarmInfo.delayInMinutes < 1) {
            return console.error(
              `Alarm delay is less than minimum of 1 minutes. In released .crx, alarm "${name}" will fire in approximately 1 minutes.`,
            );
          }

          scheduledTime = Date.now() + alarmInfo.delayInMinutes * 60000;
        }

        const alarm: chrome.alarms.Alarm = {
          periodInMinutes: alarmInfo.periodInMinutes,
          scheduledTime,
          name,
        };

        alarms.push(alarm);

        if (!alarm.periodInMinutes) {
          setTimeout(() => {
            contents.send('api-emit-event-alarms-onAlarm', alarm);
          }, alarm.scheduledTime - Date.now());
        }
      }
    },
  );

  ipcMain.on(
    `api-browserAction-setBadgeText-${ses.id}`,
    (
      e: IpcMessageEvent,
      responseId: string,
      extensionId: string,
      details: chrome.browserAction.BadgeTextDetails,
    ) => {
      const newId = makeId(32);

      if (details.tabId) {
        const wc = findWindowByWebContents(webContents.fromId(details.tabId));
        wc.send('api-browserAction-setBadgeText', newId, extensionId, details);
      } else {
        for (const wc of ses.webContents) {
          wc.send(
            'api-browserAction-setBadgeText',
            newId,
            extensionId,
            details,
          );
        }
      }

      ipcMain.on(`api-browserAction-setBadgeText-${newId}`, () => {
        e.sender.send(`api-browserAction-setBadgeText-${responseId}`);
      });
    },
  );

  ipcMain.on(
    `send-to-all-extensions-${ses.id}`,
    (e: IpcMessageEvent, msg: string, ...args: any[]) => {
      sendToBackgroundPages(ses, msg, ...args);

      const contents = getAllWebContentsInSession(ses.session);
      for (const content of contents) {
        content.send(msg, ...args);
      }
    },
  );
};
