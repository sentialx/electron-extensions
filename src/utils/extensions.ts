import { WebContents, webContents } from 'electron';
import { promises, existsSync } from 'fs';
import { resolve } from 'path';
import { format } from 'url';
import { Extension } from '../models/extension';
import { IpcExtension } from '../models/ipc-extension';
import { ExtensibleSession } from '../main';
import { getPath } from './paths';
import { StorageArea } from '../models/storage-area';

export const manifestToExtensionInfo = (manifest: chrome.runtime.Manifest) => {
  return {
    startPage: manifest.startPage,
    srcDirectory: manifest.srcDirectory,
    name: manifest.name,
    exposeExperimentalAPIs: true,
  };
};

export const getIpcExtension = (extension: Extension): IpcExtension => {
  const ipcExtension: Extension = { ...extension };

  delete ipcExtension.databases;
  delete ipcExtension.backgroundPage;

  return ipcExtension;
};

export const startBackgroundPage = async (
  extension: Extension,
  devtools: boolean = false,
) => {
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
      partition: 'persist:electron-extension',
      isBackgroundPage: true,
      preload: resolve(__dirname, '../..', 'renderer/background/index.js'),
      commandLineSwitches: ['--background-page'],
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    if (devtools) {
      contents.openDevTools();
    }

    extension.backgroundPage = {
      html,
      fileName,
      webContents: contents,
    };

    contents.loadURL(
      format({
        protocol: 'electron-extension',
        slashes: true,
        hostname: id,
        pathname: fileName,
      }),
    );
  }
};

export const sendToBackgroundPages = (
  ses: ExtensibleSession,
  msg: string,
  ...args: any[]
) => {
  for (const key in ses.extensions) {
    const { webContents } = ses.extensions[key].backgroundPage;
    webContents.send(msg, ...args);
  }
};

const loadStorages = (manifest: chrome.runtime.Manifest) => {
  const storagePath = getPath('storage/extensions', manifest.extensionId);
  const local = new StorageArea(resolve(storagePath, 'local'));
  const sync = new StorageArea(resolve(storagePath, 'sync'));
  const managed = new StorageArea(resolve(storagePath, 'managed'));

  return { local, sync, managed };
};

const loadI18n = async (manifest: chrome.runtime.Manifest) => {
  if (typeof manifest.default_locale === 'string') {
    const defaultLocalePath = resolve(
      manifest.srcDirectory,
      '_locales',
      manifest.default_locale,
    );

    if (!existsSync(defaultLocalePath)) return;

    const messagesPath = resolve(defaultLocalePath, 'messages.json');
    const stats = await promises.stat(messagesPath);

    if (!existsSync(messagesPath) || stats.isDirectory()) return;

    const data = await promises.readFile(messagesPath, 'utf8');
    const locale = JSON.parse(data);

    return locale;
  }
};

export const loadExtension = async (manifest: chrome.runtime.Manifest) => {
  const extension: Extension = {
    manifest,
    alarms: [],
    databases: loadStorages(manifest),
    locale: loadI18n(manifest),
  };

  startBackgroundPage(extension);

  return extension;
};

export const loadDevToolsExtensions = (
  webContents: WebContents,
  manifests: chrome.runtime.Manifest[],
) => {
  if (!webContents.devToolsWebContents) return;

  manifests.forEach(loadExtension);

  const extensionInfoArray = manifests.map(manifestToExtensionInfo);
  extensionInfoArray.forEach(extension => {
    (webContents.devToolsWebContents as any)._grantOriginAccess(
      extension.startPage,
    );
  });

  webContents.devToolsWebContents.executeJavaScript(
    `InspectorFrontendAPI.addExtensions(${JSON.stringify(extensionInfoArray)})`,
  );
};

export const extensionsToManifests = (extensions: {
  [key: string]: Extension;
}) => Object.values(extensions).map(item => item.manifest);
