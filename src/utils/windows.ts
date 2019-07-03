import { WebContents } from 'electron';

export const findWindowByWebContents = (
  webContents: WebContents,
): WebContents => {
  if (!webContents) return null;
  if (webContents.getType() === 'window') return webContents;
  return findWindowByWebContents(webContents.hostWebContents);
};
