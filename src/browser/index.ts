import { CookiesAPI } from './cookies';
import { TabsAPI } from './tabs';
import { BackgroundPages } from './background-pages';

export class Extensions {
  public tabs = new TabsAPI();
  public cookies = new CookiesAPI();

  public backgroundPages = new BackgroundPages();

  public initializeSession(session: Electron.Session, preloadPath: string) {
    if (session.getPreloads().includes(preloadPath)) {
      throw new Error(
        'Extension preload has already been injected into this Session.',
      );
    }
    session.setPreloads(session.getPreloads().concat(preloadPath));

    this.cookies.observeSession(session);
  }
}

export const extensions = new Extensions();
