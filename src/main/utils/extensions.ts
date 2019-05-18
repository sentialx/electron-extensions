import { WebContents, webContents } from 'electron';
import { Extension } from '~/main/models/extension';
import { promises } from 'fs';
import { resolve } from 'path';
import { format } from 'url';
import { ExtensionsMain } from '~/main';
import { IpcExtension } from '~/models';

export const getIpcExtension = (extension: Extension): IpcExtension => {
  const ipcExtension: Extension = { ...extension };

  delete ipcExtension.databases;
  delete ipcExtension.backgroundPage;

  return ipcExtension;
};

export const startBackgroundPage = async (extension: Extension) => {
  const { manifest, path, id } = extension;

  if (manifest.background) {
    const { background } = manifest;
    const { page, scripts } = background;

    let html = Buffer.from('');
    let fileName: string;

    if (page) {
      fileName = page;
      html = await promises.readFile(resolve(path, page));
    } else if (scripts) {
      fileName = 'generated.html';
      html = Buffer.from(
        `<html>
          <body>${scripts
            .map(script => `<script src="${script}"></script>`)
            .join('')}
          </body>
        </html>`,
        'utf8',
      );
    }

    const contents: WebContents = (webContents as any).create({
      partition: 'persist:wexond_extension',
      isBackgroundPage: true,
      preload: `${__dirname}/../renderer/background/index.js`,
      enableRemoteModule: false,
      sandbox: true,
      commandLineSwitches: ['--background-page'],
      webPreferences: {
        nodeIntegration: false,
      },
    });

    extension.backgroundPage = {
      html,
      fileName,
      webContents: contents,
    };

    contents.loadURL(
      format({
        protocol: 'wexond-extension',
        slashes: true,
        hostname: id,
        pathname: fileName,
      }),
    );
  }
};

export const sendToAllBackgroundPages = (
  main: ExtensionsMain,
  msg: string,
  ...args: any[]
) => {
  for (const key in main.extensions) {
    const { webContents } = main.extensions[key].backgroundPage;
    webContents.send(msg, ...args);
  }
};
