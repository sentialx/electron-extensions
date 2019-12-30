import { BackgroundPage } from './background-page';
import { IContentScript } from './content-scripts';

export interface IpcExtension {
  id?: string;
  manifest?: chrome.runtime.Manifest;
  path?: string;
  locale?: any;
  alarms?: any[];
  backgroundPage?: BackgroundPage;
  contentScripts?: IContentScript[];
  popupPage?: string;
}
