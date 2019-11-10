import { WebContents, webContents } from 'electron';
import { promises, existsSync } from 'fs';
import { resolve } from 'path';
import { format } from 'url';
import { IpcExtension } from '../models/ipc-extension';
import { ExtensibleSession, storages } from '../main';
import { getPath } from './paths';
import { StorageArea } from '../models/storage-area';

export const manifestToExtensionInfo = (manifest: chrome.runtime.Manifest) => {
  return {
    startPage: format({
      protocol: 'electron-extension',
      slashes: true,
      hostname: manifest.extensionId,
      pathname: manifest.devtools_page,
    }),
    srcDirectory: manifest.srcDirectory,
    name: manifest.name,
    exposeExperimentalAPIs: true,
  };
};

export const getIpcExtension = (extension: IpcExtension): IpcExtension => {
  const ipcExtension: IpcExtension = { ...extension };

  delete ipcExtension.backgroundPage;

  return ipcExtension;
};

export const startBackgroundPage = async (
  { background, srcDirectory, extensionId }: chrome.runtime.Manifest,
  sessionId: number,
  preloadPath: string,
) => {
  if (background) {
    const { page, scripts } = background;

    let html = Buffer.from('');
    let fileName: string;

    if (page) {
      fileName = page;
      html = await promises.readFile(resolve(srcDirectory, page));
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
      partition: `persist:electron-extension-${sessionId}`,
      isBackgroundPage: true,
      preload: preloadPath,
      type: 'backgroundPage',
      commandLineSwitches: ['--background-page'],
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    contents.loadURL(
      format({
        protocol: 'electron-extension',
        slashes: true,
        hostname: extensionId,
        pathname: fileName,
      }),
    );

    return {
      html,
      fileName,
      webContents: contents,
    };
  }
  return null;
};

export const sendToBackgroundPages = (
  ses: ExtensibleSession,
  msg: string,
  ...args: any[]
) => {
  for (const key in ses.extensions) {
    const { webContents } = ses.extensions[key].backgroundPage;
    if (!webContents.isDestroyed()) {
      webContents.send(msg, ...args);
    }
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

export const loadExtension = async (
  manifest: chrome.runtime.Manifest,
  sessionId: number,
  preloadPath: string,
) => {
  const extension: IpcExtension = {
    manifest,
    alarms: [],
    locale: await loadI18n(manifest),
    id: manifest.extensionId,
    path: manifest.srcDirectory,
    backgroundPage: await startBackgroundPage(manifest, sessionId, preloadPath),
  };

  if (!storages.get(manifest.extensionId)) {
    storages.set(manifest.extensionId, loadStorages(manifest));
  }

  return extension;
};

export const loadDevToolsExtensions = (
  webContents: WebContents,
  manifests: chrome.runtime.Manifest[],
) => {
  if (!webContents.devToolsWebContents) return;

  const extensionInfoArray = manifests.map(manifestToExtensionInfo);
  extensionInfoArray.forEach(extension => {
    if (!extension.startPage) return;
    (webContents.devToolsWebContents as any)._grantOriginAccess(
      extension.startPage,
    );
  });

  /*webContents.devToolsWebContents.executeJavaScript(
    `InspectorFrontendAPI.addExtensions(${JSON.stringify(extensionInfoArray)})`,
  );*/
};

export const extensionsToManifests = (extensions: {
  [key: string]: IpcExtension;
}) => Object.values(extensions).map(item => item.manifest);
