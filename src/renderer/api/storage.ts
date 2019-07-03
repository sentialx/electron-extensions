import { ipcRenderer } from 'electron';

import { makeId } from '../../utils/string';

const sendStorageOperation = (
  extensionId: string,
  arg: any,
  area: string,
  type: string,
  callback: any,
) => {
  const id = makeId(32);
  ipcRenderer.send('api-storage-operation', {
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

const getStorageArea = (id: string, area: string) => ({
  set: (arg: any, cb: any) => sendStorageOperation(id, arg, area, 'set', cb),
  get: (arg: any, cb: any) => sendStorageOperation(id, arg, area, 'get', cb),
  remove: (arg: any, cb: any) =>
    sendStorageOperation(id, arg, area, 'remove', cb),
  clear: (arg: any, cb: any) =>
    sendStorageOperation(id, arg, area, 'clear', cb),
});

export const getStorage = (extensionId: string) => ({
  local: getStorageArea(extensionId, 'local'),
  managed: getStorageArea(extensionId, 'managed'),
});
