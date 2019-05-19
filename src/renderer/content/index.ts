import { ipcRenderer, webFrame, remote, IpcMessageEvent } from 'electron';
import { readFileSync } from 'fs';
import { join } from 'path';
import { format, parse } from 'url';
import { runInThisContext } from 'vm';
import { getAPI } from '../api';
import { IpcExtension } from '../../models';
import { matchesPattern } from '../../utils/url';

const extensions: { [key: string]: IpcExtension } = ipcRenderer.sendSync(
  'get-extensions',
);

webFrame.executeJavaScript('window', false, w => {
  w.chrome = {
    webstorePrivate: {
      install: () => {},
    },
    app: {
      isInstalled: false,
      getIsInstalled: () => {
        return false;
      },
      getDetails: () => {},
      installState: () => {},
    },
  };
});

ipcRenderer.on(
  'execute-script-isolated',
  (
    e: IpcMessageEvent,
    { details, extensionId, responseId }: any,
    webContentsId: number,
  ) => {
    const worldId = getIsolatedWorldId(extensionId);
    injectChromeApi(extensions[extensionId], worldId);

    webFrame.executeJavaScriptInIsolatedWorld(
      worldId,
      [
        {
          code: details.code,
        },
      ],
      false,
      (result: any) => {
        remote.webContents
          .fromId(webContentsId)
          .send(`api-tabs-executeScript-${responseId}`, result);
      },
    );
  },
);

const injectChromeApi = (extension: IpcExtension, worldId: number) => {
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

const injectContentScript = (script: any, extension: IpcExtension) => {
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

let nextIsolatedWorldId = 1000;
const isolatedWorldsRegistry: any = {};

const getIsolatedWorldId = (id: string) => {
  if (isolatedWorldsRegistry[id]) {
    return isolatedWorldsRegistry[id];
  }
  nextIsolatedWorldId++;
  return (isolatedWorldsRegistry[id] = nextIsolatedWorldId);
};

const setImmediateTemp: any = setImmediate;

process.once('loaded', () => {
  global.setImmediate = setImmediateTemp;

  Object.keys(extensions).forEach(key => {
    const extension = extensions[key];
    const { manifest } = extension;

    if (manifest.content_scripts) {
      const readArrayOfFiles = (relativePath: string) => ({
        url: `chrome-extension://${extension.id}/${relativePath}`,
        code: readFileSync(join(extension.path, relativePath), 'utf8'),
      });

      try {
        manifest.content_scripts.forEach(script => {
          const newScript = {
            matches: script.matches,
            js: script.js ? script.js.map(readArrayOfFiles) : [],
            css: script.css ? script.css.map(readArrayOfFiles) : [],
            runAt: script.run_at || 'document_idle',
          };

          injectContentScript(newScript, extension);
        });
      } catch (readError) {
        console.error('Failed to read content scripts', readError);
      }
    }
  });
});
