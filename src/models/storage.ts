import { StorageArea } from './storage-area';

export interface IStorage {
  [key: string]: StorageArea;
  local?: StorageArea;
  sync?: StorageArea;
  managed?: StorageArea;
}
