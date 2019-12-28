import { protocol, session } from 'electron';
import { readFile } from 'fs';
import { join } from 'path';
import { parse } from 'url';
import { ExtensibleSession } from '..';

if (protocol) {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'electron-extension',
      privileges: {
        bypassCSP: true,
        secure: true,
        standard: true,
        supportFetchAPI: true,
        allowServiceWorkers: true,
        corsEnabled: true,
      },
    },
  ]);
}

const registerProtocol = (
  extensibleSession: ExtensibleSession,
  ses: Electron.Session,
) => {
  ses.protocol.registerBufferProtocol(
    'electron-extension',
    (request, callback) => {
      const parsed = parse(decodeURIComponent(request.url));

      if (!parsed.hostname || !parsed.pathname) {
        return callback();
      }

      const extension = extensibleSession.extensions[parsed.hostname];

      if (!extension) {
        return callback();
      }

      const { backgroundPage, path } = extension;

      if (backgroundPage && parsed.pathname === `/${backgroundPage.fileName}`) {
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

export const registerProtocols = (ses: ExtensibleSession) => {
  registerProtocol(
    ses,
    session.fromPartition(`persist:electron-extension-${ses.id}`),
  );

  registerProtocol(ses, ses.session);
};
