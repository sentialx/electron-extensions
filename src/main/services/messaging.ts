import { webContents, ipcMain, IpcMessageEvent, Session } from 'electron';
import { getIpcExtension, sendToBackgroundPages } from '../../utils/extensions';
import { ExtensibleSession } from '..';
import { getAllWebContentsInSession } from '../../utils/web-contents';

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

  ipcMain.on(`api-tabs-query-${ses.id}`, (e: Electron.IpcMessageEvent) => {
    // TODO:
    // appWindow.webContents.send("api-tabs-query", e.sender.id);
  });

  ipcMain.on(
    `api-tabs-create-${ses.id}`,
    (e: IpcMessageEvent, data: chrome.tabs.CreateProperties) => {
      // TODO:
      // appWindow.webContents.send("api-tabs-create", data, e.sender.id);
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
    (e: IpcMessageEvent, ...args: any[]) => {
      /*
    TODO:
    appWindow.webContents.send(
      'api-browserAction-setBadgeText',
      e.sender.id,
      ...args,
    );
    */
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

  ipcMain.on(
    `emit-tabs-event-${ses.id}`,
    (e: any, name: string, ...data: any[]) => {
      // TODO: UI
      // appWindow.viewManager.sendToAll(`api-emit-event-tabs-${name}`, ...data);
      sendToBackgroundPages(ses, `api-emit-event-tabs-${name}`, ...data);
    },
  );
};
