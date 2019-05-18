import { Session, app } from 'electron';

export class ExtensionsMain {
  constructor(session: Session) {
    session.setPreloads([
      `${app.getAppPath()}/build/renderer/content/index.js`,
    ]);
  }
}
