import { Session, app } from 'electron';

export class ExtensionsMain {
  constructor(session: Session) {
    session.setPreloads([`${__dirname}/../renderer/content/index.js`]);
  }
}
