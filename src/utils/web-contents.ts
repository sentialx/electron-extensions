import { PROTOCOL_SCHEME } from '../constants';
import { randomId } from './string';
import { ipcMain } from 'electron';

// TODO: https://github.com/electron/electron/pull/22217
export const isBackgroundPage = (wc: Electron.WebContents) =>
  // TODO: wc.getType() === 'backgroundPage';
  wc.getType() === 'remote' && wc.getURL().startsWith(PROTOCOL_SCHEME);

export const webContentsInvoke = (
  wc: Electron.WebContents,
  channel: string,
  ...args: any[]
): Promise<any> =>
  new Promise((resolve) => {
    const id = randomId();

    ipcMain.once(`${channel}-${id}`, (e: any, ...a: any[]) => resolve(...a));

    wc.send(channel, ...args, id);
  });
