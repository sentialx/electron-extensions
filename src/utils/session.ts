import { session } from 'electron';

export const sessionFromIpcEvent = (e: Electron.IpcMainEvent) =>
  e.sender.session || session.defaultSession;
