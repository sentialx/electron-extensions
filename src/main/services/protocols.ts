import { app, protocol } from 'electron';
import { readFile } from 'fs';
import { join } from 'path';
import { parse } from 'url';
import { ExtensionsMain } from '..';

export const registerProtocols = (main: ExtensionsMain) => {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'wexond-extension',
      privileges: { bypassCSP: true, secure: true },
    },
  ]);

  (app as any).on('session-created', (sess: Electron.session) => {
    sess.protocol.registerBufferProtocol(
      'wexond-extension',
      (request, callback) => {
        const parsed = parse(decodeURIComponent(request.url));

        if (!parsed.hostname || !parsed.pathname) {
          return callback();
        }

        const extension = main.extensions[parsed.hostname];

        if (!extension) {
          return callback();
        }

        const { backgroundPage, path } = extension;

        if (
          backgroundPage &&
          parsed.pathname === `/${backgroundPage.fileName}`
        ) {
          return callback({
            mimeType: 'text/html',
            data: backgroundPage.html,
          });
        }

        readFile(join(path, parsed.pathname), (err, content) => {
          if (err) {
            return (callback as any)(-6); // FILE_NOT_FOUND
          }
          return callback(content);
        });

        return null;
      },
      error => {
        if (error) {
          console.error(`Failed to register extension protocol: ${error}`);
        }
      },
    );
  });
};
