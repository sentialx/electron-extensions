import { format, parse } from 'url';
import { webFrame } from 'electron';

import { matchesPattern } from '../utils/url';
import { IpcExtension } from '../models/ipc-extension';
import { getAPI } from '../api';
import { getIsolatedWorldId } from '../utils/isolated-worlds';

export const injectChromeApi = async (
  extension: IpcExtension,
  worldId: number,
  sessionId: number,
) => {
  const context = getAPI(extension, sessionId);

  webFrame.setIsolatedWorldInfo(worldId, {
    name,
  });

  const w: any = await webFrame.executeJavaScriptInIsolatedWorld(worldId, [
    {
      code: 'window',
    },
  ]);

  w.chrome = w.browser = context;
};

const runContentScript = async (
  url: string,
  code: string,
  extension: IpcExtension,
  worldId: number,
  sessionId: number,
) => {
  const parsed = parse(url);
  await injectChromeApi(extension, worldId, sessionId);

  webFrame.executeJavaScriptInIsolatedWorld(worldId, [
    {
      code,
      url: format({
        protocol: parsed.protocol,
        slashes: true,
        hostname: extension.id,
        pathname: parsed.pathname,
      }),
    },
  ]);
};

const runStylesheet = (code: string) => {
  const styleElement = document.createElement('style');
  styleElement.textContent = code;
  document.body.appendChild(styleElement);
};

export const injectContentScript = (
  script: any,
  extension: IpcExtension,
  sessionId: number,
) => {
  if (
    !script.matches.some((x: string) =>
      matchesPattern(
        x,
        `${location.protocol}//${location.host}${location.pathname}`,
      ),
    )
  ) {
    return;
  }

  process.setMaxListeners(0);

  if (script.js) {
    script.js.forEach((js: any) => {
      const fire = runContentScript.bind(
        window,
        js.url,
        js.code,
        extension,
        getIsolatedWorldId(extension.id),
        sessionId,
      );

      if (script.runAt === 'document_start') {
        fire();
      } else if (script.runAt === 'document_end') {
        (process as any).once('document-end', fire);
      } else {
        document.addEventListener('DOMContentLoaded', fire);
      }
    });
  }

  if (script.css) {
    script.css.forEach((css: any) => {
      const fire = runStylesheet.bind(window, css.code);
      if (script.runAt === 'document_start') {
        fire();
      } else if (script.runAt === 'document_end') {
        (process as any).once('document-end', fire);
      } else {
        document.addEventListener('DOMContentLoaded', fire);
      }
    });
  }
};
