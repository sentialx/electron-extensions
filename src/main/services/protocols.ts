import { protocol, app, session } from 'electron';
import { readFile } from 'fs';
import { join } from 'path';
import { parse } from 'url';
import { ExtensibleSession } from '..';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'electron-extension',
    privileges: { bypassCSP: true, secure: true },
  },
]);

export const registerProtocols = (ses: ExtensibleSession) => {
  session
    .fromPartition(`persist:electron-extension-${ses.id}`)
    .protocol.registerBufferProtocol(
      'electron-extension',
      (request, callback) => {
        const parsed = parse(decodeURIComponent(request.url));

        if (!parsed.hostname || !parsed.pathname) {
          return callback();
        }

        const extension = ses.extensions[parsed.hostname];

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
};
