import { PROTOCOL_SCHEME } from '../constants';

// TODO: https://github.com/electron/electron/pull/22217
export const isBackgroundPage = (wc: Electron.WebContents) =>
  // TODO: wc.getType() === 'backgroundPage';
  wc.getType() === 'remote' && wc.getURL().startsWith(PROTOCOL_SCHEME);
