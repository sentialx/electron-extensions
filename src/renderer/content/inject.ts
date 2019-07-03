import { runInThisContext } from 'vm';
import { format, parse } from 'url';
import { webFrame } from 'electron';

import { matchesPattern } from '../../utils/url';
import { IpcExtension } from '../../models/ipc-extension';
import { getAPI } from '../api';
import { getIsolatedWorldId } from '../../utils/isolated-worlds';

const runContentScript = (
  url: string,
  code: string,
  extension: IpcExtension,
  worldId: number,
) => {
  const parsed = parse(url);
  injectChromeApi(extension, worldId);

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

const runStylesheet = (url: string, code: string) => {
  const wrapper = `((code) => {
    const styleElement = document.createElement('style');
    styleElement.textContent = code;
    document.head.append(styleElement);
  })`;

  const compiledWrapper = runInThisContext(wrapper, {
    filename: url,
    lineOffset: 1,
    displayErrors: true,
  });

  return compiledWrapper.call(window, code);
};

export const injectContentScript = (script: any, extension: IpcExtension) => {
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
      );

      if (script.runAt === 'document_start') {
        (process as any).once('document-start', fire);
      } else if (script.runAt === 'document_end') {
        (process as any).once('document-end', fire);
      } else {
        document.addEventListener('DOMContentLoaded', fire);
      }
    });
  }

  if (script.css) {
    script.css.forEach((css: any) => {
      const fire = runStylesheet.bind(window, css.url, css.code);
      if (script.runAt === 'document_start') {
        (process as any).once('document-start', fire);
      } else if (script.runAt === 'document_end') {
        (process as any).once('document-end', fire);
      } else {
        document.addEventListener('DOMContentLoaded', fire);
      }
    });
  }
};

export const injectChromeApi = (extension: IpcExtension, worldId: number) => {
  const context = getAPI(extension);

  webFrame.setIsolatedWorldHumanReadableName(worldId, name);
  webFrame.executeJavaScriptInIsolatedWorld(
    worldId,
    [
      {
        code: 'window',
      },
    ],
    false,
    (window: any) => {
      window.chrome = window.browser = context;
    },
  );
};
