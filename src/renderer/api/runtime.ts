import { remote, ipcRenderer } from 'electron';
import { format } from 'url';

import { IpcExtension } from '../../models/ipc-extension';
import { LocalEvent } from './events/local-event';
import { makeId } from '../../utils/string';
import { Port } from '../../models/port';

const getSender = (id: string): chrome.runtime.MessageSender => ({
  id,
  url: window.location.href,
  frameId: 0,
  tab: { id: remote.getCurrentWebContents().id } as any,
});

export const getRuntime = (extension: IpcExtension, sessionId: number) => ({
  lastError: null as any,
  id: extension.id,
  onConnect: new LocalEvent(),
  onMessage: new LocalEvent(),
  onInstalled: new LocalEvent(),

  sendMessage: (...args: any[]) => {
    const sender = getSender(extension.id);
    const portId = makeId(32);

    let extensionId = args[0];
    let message = args[1];
    let options = args[2];
    let responseCallback = args[3];

    if (typeof args[0] === 'object') {
      message = args[0];
      extensionId = extension.id;
    }

    if (typeof args[1] === 'object') {
      options = args[1];
    }

    if (typeof args[1] === 'function') {
      responseCallback = args[1];
    }

    if (typeof args[2] === 'function') {
      responseCallback = args[2];
    }

    if (options && options.includeTlsChannelId) {
      sender.tlsChannelId = portId;
    }

    if (typeof responseCallback === 'function') {
      ipcRenderer.on(
        `api-runtime-sendMessage-response-${portId}`,
        (e: Electron.IpcMessageEvent, res: any) => {
          responseCallback(res);
        },
      );
    }

    ipcRenderer.send(`api-runtime-sendMessage-${sessionId}`, {
      extensionId,
      portId,
      sender,
      message,
    });
  },

  connect: (...args: any[]) => {
    const sender = getSender(extension.id);
    const portId = makeId(32);

    let name: string = null;
    let extensionId: string = extension.id;

    if (typeof args[0] === 'string') {
      extensionId = args[0];

      if (args[1] && typeof args[1] === 'object') {
        if (args[1].includeTlsChannelId) {
          sender.tlsChannelId = portId;
        }
        name = args[1].name;
      }
    } else if (args[0] && typeof args[0] === 'object') {
      if (args[0].includeTlsChannelId) {
        sender.tlsChannelId = portId;
      }
      name = args[0].name;
    }

    ipcRenderer.send(`api-runtime-connect-${sessionId}`, {
      extensionId,
      portId,
      sender,
      name,
    });

    return new Port(portId, name);
  },

  reload: () => {
    ipcRenderer.send(`api-runtime-reload-${sessionId}`, extension.id);
  },

  getURL: (path: string) =>
    format({
      protocol: 'electron-extension',
      slashes: true,
      hostname: extension.id,
      pathname: path,
    }),

  getManifest: () => extension.manifest,
});
