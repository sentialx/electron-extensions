import { IpcExtension } from '../models/ipc-extension';
import { ipcRenderer } from 'electron';
import { IpcEvent } from '../models/ipc-event';

const callCookiesMethod = async (
  method: 'getAll' | 'remove' | 'set',
  details: any,
  sessionId: number,
) => {
  return await ipcRenderer.invoke(
    `api-cookies-${method}-${sessionId}`,
    details,
  );
};

export const cookies = (extension: IpcExtension, sessionId: number) => ({
  onChanged: new IpcEvent('cookies', 'onChanged', sessionId),

  get: async (details: any, callback: any) => {
    if (callback)
      callback((await callCookiesMethod('getAll', details, sessionId))[0]);
  },

  getAll: async (details: any, callback: any) => {
    if (callback)
      callback(await callCookiesMethod('getAll', details, sessionId));
  },

  set: async (details: any, callback: any) => {
    if (callback) callback(await callCookiesMethod('set', details, sessionId));
  },

  remove: async (details: any, callback: any) => {
    if (callback)
      callback(await callCookiesMethod('remove', details, sessionId));
  },
});
