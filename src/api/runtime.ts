import { ipcRenderer } from 'electron';
import { format } from 'url';

import { IpcExtension } from '../models/ipc-extension';
import { LocalEvent } from '../models/local-event';
import { makeId } from '../utils/string';
import { Port } from '../models/port';
import { getSenderContent } from '../utils/sender';
import { PROTOCOL } from '../constants';

export const getRuntime = (extension: IpcExtension, sessionId: number) => ({
  lastError: null as any,
  id: extension.id,
  onConnect: new LocalEvent(),
  onMessage: new LocalEvent(),
  onInstalled: new LocalEvent(),
  onUpdateAvailable: new LocalEvent(),

  sendMessage: (...args: any[]) => {
    const sender = getSenderContent(extension.id, sessionId);
    const portId = makeId(32);

    let extensionId = extension.id;
    let message = args[0];
    let options = args[1];
    let responseCallback = args[2];

    if (
      typeof args[0] === 'string' &&
      typeof args[2] === 'object' &&
      typeof args[3] === 'function'
    ) {
      extensionId = args[0];
      message = args[1];
      options = args[2];
      responseCallback = args[3];
    } else if (typeof args[0] === 'string' && typeof args[2] === 'object') {
      extensionId = args[0];
      message = args[1];
      options = args[2];
      responseCallback = undefined;
    } else if (
      args.length === 2 &&
      typeof args[0] === 'string' &&
      typeof args[1] !== 'function'
    ) {
      extensionId = args[0];
      message = args[1];
      options = undefined;
      responseCallback = undefined;
    } else if (args.length === 1) {
      options = undefined;
      responseCallback = undefined;
    } else if (args.length === 2 && typeof args[1] === 'function') {
      responseCallback = args[1];
      options = undefined;
    }

    if (options && options.includeTlsChannelId) {
      sender.tlsChannelId = portId;
    }

    if (typeof responseCallback === 'function') {
      ipcRenderer.on(
        `api-runtime-sendMessage-response-${portId}`,
        (e, res: any) => {
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
    const sender = getSenderContent(extension.id, sessionId);
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

    return new Port(sessionId, portId, name);
  },

  reload: () => {
    ipcRenderer.send(`api-runtime-reload-${sessionId}`, extension.id);
  },

  getURL: (path: string) =>
    format({
      protocol: PROTOCOL,
      slashes: true,
      hostname: extension.id,
      pathname: path,
    }),

  getManifest: () => extension.manifest,
});
