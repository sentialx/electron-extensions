import { session, app } from 'electron';
import { parse } from 'url';
import { EventEmitter } from 'events';

const backgroundPages: Set<Electron.WebContents> = new Set();

export const sendToHosts = (channel: string, ...args: any[]) => {
  backgroundPages.forEach((webContents) => {
    if (webContents.isDestroyed()) return;
    webContents.send(channel, ...args);
  });
};

export const registerBackgroundPage = (host: Electron.WebContents) => {
  backgroundPages.add(host);

  host.once('destroyed', () => {
    backgroundPages.delete(host);
  });
};

export const getBackgroundPage = (
  extensionId: string,
  ses: Electron.Session = null,
) => {
  if (!ses) ses = session.defaultSession;

  return Array.from(backgroundPages).find(
    (x) => parse(x.getURL()).hostname === extensionId && x.session === ses,
  );
};

export declare interface BackgroundPages {
  on(
    event: 'register',
    listener: (tabId: number, windowId: number) => void,
  ): this;
  on(event: string, listener: Function): this;
}

export class BackgroundPages extends EventEmitter {
  public observe() {
    app.on('web-contents-created', (e, webContents) => {
      // TODO: https://github.com/electron/electron/pull/22217
      // if (webContents.getType() === 'backgroundPage') {
      if (
        webContents.getType() === 'remote' &&
        webContents.getURL().startsWith('chrome-extension://')
      ) {
        this.register(webContents);
      }
    });
  }

  public get(extensionId: string, session: Electron.Session) {
    return getBackgroundPage(extensionId, session);
  }

  public register(webContents: Electron.WebContents) {
    registerBackgroundPage(webContents);
  }
}
