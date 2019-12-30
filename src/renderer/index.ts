import { ipcRenderer } from 'electron';
import { IpcExtension } from '../models/ipc-extension';

const webContentsId = ipcRenderer.sendSync(`get-webcontents-id`);

export class ExtensionsRenderer {
  public browserAction = {
    onClicked: (extensionId: string, tabId: number) => {
      ipcRenderer.send(
        `api-browserAction-onClicked-${webContentsId}`,
        extensionId,
        tabId,
      );
    },
  };

  public getExtensions(): { [key: string]: IpcExtension } {
    return ipcRenderer.sendSync(`get-extensions-${webContentsId}`);
  }
}

export const extensionsRenderer = new ExtensionsRenderer();
