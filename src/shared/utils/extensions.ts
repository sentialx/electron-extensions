import { ipcRenderer, remote } from 'electron';
import { IpcExtension } from '../models';
import { API, Port } from '~/renderer/api';

export const getAPI = (extension: IpcExtension, tabId: number = null) => {
  const api = new API(extension, tabId);

  ipcRenderer.on(
    'api-runtime-connect',
    (e: Electron.IpcMessageEvent, data: any) => {
      const { portId, sender, name } = data;
      const port = new Port(portId, name, sender);
      api.runtime.onConnect.emit(port);
    },
  );

  ipcRenderer.on(
    'api-runtime-sendMessage',
    (e: Electron.IpcMessageEvent, data: any, webContentsId: number) => {
      const { portId, sender, message } = data;

      const sendResponse = (msg: any) => {
        remote.webContents
          .fromId(webContentsId)
          .send(`api-runtime-sendMessage-response-${portId}`, msg);
      };

      api.runtime.onMessage.emit(message, sender, sendResponse);
    },
  );

  return api;
};
