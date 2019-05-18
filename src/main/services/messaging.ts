import { webContents, ipcMain, IpcMessageEvent } from 'electron';
import { ExtensionsMain } from '..';
import { getIpcExtension, sendToAllBackgroundPages } from '../utils/extensions';

export const runMessagingService = (main: ExtensionsMain) => {
  ipcMain.on('get-extension', (e: IpcMessageEvent, id: string) => {
    e.returnValue = getIpcExtension(main.extensions[id]);
  });

  ipcMain.on('get-extensions', (e: IpcMessageEvent) => {
    const list = { ...main.extensions };

    for (const key in list) {
      list[key] = getIpcExtension(list[key]);
    }

    e.returnValue = list;
  });

  ipcMain.on('api-tabs-query', (e: Electron.IpcMessageEvent) => {
    // TODO:
    // appWindow.webContents.send("api-tabs-query", e.sender.id);
  });

  ipcMain.on(
    'api-tabs-create',
    (e: IpcMessageEvent, data: chrome.tabs.CreateProperties) => {
      // TODO:
      // appWindow.webContents.send("api-tabs-create", data, e.sender.id);
    },
  );

  ipcMain.on(
    'api-tabs-insertCSS',
    (e: IpcMessageEvent, tabId: number, details: chrome.tabs.InjectDetails) => {
      const contents = webContents.fromId(tabId);

      if (contents) {
        contents.insertCSS(details.code);
        e.sender.send('api-tabs-insertCSS');
      }
    },
  );

  ipcMain.on('api-tabs-executeScript', (e: IpcMessageEvent, data: any) => {
    const { tabId } = data;
    const contents = webContents.fromId(tabId);

    if (contents) {
      contents.send('execute-script-isolated', data, e.sender.id);
    }
  });

  ipcMain.on(
    'api-runtime-reload',
    (e: IpcMessageEvent, extensionId: string) => {
      const { backgroundPage } = main.extensions[extensionId];

      if (backgroundPage) {
        const contents = webContents.fromId(e.sender.id);
        contents.reload();
      }
    },
  );

  ipcMain.on(
    'api-runtime-connect',
    async (e: IpcMessageEvent, { extensionId, portId, sender, name }: any) => {
      const { backgroundPage } = main.extensions[extensionId];
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
    'api-runtime-sendMessage',
    async (e: IpcMessageEvent, data: any) => {
      const { extensionId } = data;
      const { backgroundPage } = main.extensions[extensionId];
      const { webContents } = backgroundPage;

      if (e.sender.id !== webContents.id) {
        webContents.send('api-runtime-sendMessage', data, e.sender.id);
      }
    },
  );

  ipcMain.on(
    'api-port-postMessage',
    (e: IpcMessageEvent, { portId, msg }: any) => {
      Object.keys(main.extensions).forEach(key => {
        const { backgroundPage } = main.extensions[key];
        const { webContents } = backgroundPage;

        if (e.sender.id !== webContents.id) {
          webContents.send(`api-port-postMessage-${portId}`, msg);
        }
      });

      /* TODO:
    for (const key in appWindow.viewManager.views) {
      const view = appWindow.viewManager.views[key];
      if (view.webContents.id !== e.sender.id) {
        view.webContents.send(`api-port-postMessage-${portId}`, msg);
      }
    }*/
    },
  );

  ipcMain.on(
    'api-storage-operation',
    (e: IpcMessageEvent, { extensionId, id, area, type, arg }: any) => {
      const { databases } = main.extensions[extensionId];

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

  ipcMain.on('api-alarms-operation', (e: IpcMessageEvent, data: any) => {
    const { extensionId, type } = data;
    const contents = webContents.fromId(e.sender.id);

    if (type === 'create') {
      const extension = main.extensions[extensionId];
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
  });

  ipcMain.on(
    'api-browserAction-setBadgeText',
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
    'send-to-all-extensions',
    (e: IpcMessageEvent, msg: string, ...args: any[]) => {
      sendToAllBackgroundPages(main, msg, ...args);
      // TODO: UI
      // appWindow.viewManager.sendToAll(msg, ...args);
    },
  );

  ipcMain.on('emit-tabs-event', (e: any, name: string, ...data: any[]) => {
    // TODO: UI
    // appWindow.viewManager.sendToAll(`api-emit-event-tabs-${name}`, ...data);
    sendToAllBackgroundPages(main, `api-emit-event-tabs-${name}`, ...data);
  });
};
