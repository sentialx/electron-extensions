import { CookiesAPI } from './cookies';
import { TabsAPI } from './tabs';
import { BackgroundPages } from './background-pages';
import { WindowsAPI } from './windows';
import { hookExtensionWebRequestBypass } from './web-request-electron';
import { WebRequestAPI } from './web-request-api';
import { BrowserActionAPI } from './browser-action';

export class Extensions {
  public static instance = new Extensions();

  public tabs = new TabsAPI();
  public cookies = new CookiesAPI();
  public windows = new WindowsAPI();
  public webRequest = new WebRequestAPI();
  public browserAction = new BrowserActionAPI();

  public backgroundPages = new BackgroundPages();

  public initializeSession(session: Electron.Session, preloadPath: string) {
    if (session.getPreloads().includes(preloadPath)) {
      throw new Error(
        'Extension preload has already been injected into this Session.',
      );
    }
    session.setPreloads(session.getPreloads().concat(preloadPath));

    hookExtensionWebRequestBypass(session);
    this.cookies.observeSession(session);
  }
}

export const extensions = Extensions.instance;

export * from '../utils/session';
