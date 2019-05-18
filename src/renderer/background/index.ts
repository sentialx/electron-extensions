import { ipcRenderer, webFrame } from 'electron';
import { IpcExtension } from '~/shared/models';
import { getAPI } from '~/shared/utils/extensions';
import { parse } from 'url';

declare const window: any;
declare const global: any;

// Mixmax detect the navigator user agent for his own desktop app
// and add a behvior that is not compliant with our mechanism.
// Electron itself isn't responsible for navigator behavior
// as the Electron team don't overwrite any of those APIs for now.
// ref: https://github.com/electron/electron/issues/11290#issuecomment-362301961

Object.defineProperty(window.navigator, 'userAgent', {
  value: window.navigator.userAgent.replace(/Electron\/\S*\s/, ''),
  configurable: false,
  writable: false,
});

ipcRenderer.setMaxListeners(0);

const extensionId = parse(window.location.href).hostname;

const extension: IpcExtension = ipcRenderer.sendSync(
  'get-extension',
  extensionId,
);

process.once('loaded', () => {
  const api = getAPI(extension);

  window.chrome = api;
  window.browser = api;

  process.once('loaded', () => {
    delete global.require;
    delete global.module;
    delete global.Buffer;
    delete global.setImmediate;
    delete global.clearImmediate;
    delete global.global;
  });
});
