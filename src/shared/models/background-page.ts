import { WebContents } from 'electron';

export interface BackgroundPage {
  html: Buffer;
  fileName: string;
  webContents: WebContents;
}
