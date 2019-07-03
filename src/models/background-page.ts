export interface BackgroundPage {
  html: Buffer;
  fileName: string;
  webContents: Electron.WebContents;
}
