import { IpcExtension } from './ipc-extension';
import { StorageArea } from './storage-area';

export interface Extension extends IpcExtension {
  databases?: {
    [key: string]: StorageArea;
    local: StorageArea;
    sync: StorageArea;
    managed: StorageArea;
  };
}
