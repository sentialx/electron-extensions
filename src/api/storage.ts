import { ipcRenderer } from 'electron';

import { makeId } from '../utils/string';

const sendStorageOperation = (
  extensionId: string,
  arg: any,
  area: string,
  type: string,
  callback: any,
  sessionId: number,
) => {
  const id = makeId(32);
  ipcRenderer.send(`api-storage-operation-${sessionId}`, {
    extensionId,
    id,
    arg,
    type,
    area,
  });

  if (callback) {
    ipcRenderer.once(
      `api-storage-operation-${id}`,
      (e: any, ...data: any[]) => {
        callback(data[0]);
      },
    );
  }
};

const getStorageArea = (id: string, area: string, sessionId: number) => ({
  set: (arg: any, cb: any) =>
    sendStorageOperation(id, arg, area, 'set', cb, sessionId),
  get: (arg: any, cb: any) =>
    sendStorageOperation(id, arg, area, 'get', cb, sessionId),
  remove: (arg: any, cb: any) =>
    sendStorageOperation(id, arg, area, 'remove', cb, sessionId),
  clear: (arg: any, cb: any) =>
    sendStorageOperation(id, arg, area, 'clear', cb, sessionId),
});

export const getStorage = (extensionId: string, sessionId: number) => ({
  local: getStorageArea(extensionId, 'local', sessionId),
  managed: getStorageArea(extensionId, 'managed', sessionId),
  sync: getStorageArea(extensionId, 'sync', sessionId),
  onChanged: {
    addListener: () => {},
  },
});
