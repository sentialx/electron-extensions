import { ipcRenderer } from 'electron';
import { LocalEvent } from './local-event';
import { getSenderTab } from '../utils/sender';

export class Port {
  public sender: chrome.runtime.MessageSender;
  public name: string;
  public onMessage = new LocalEvent();
  public onDisconnect = new LocalEvent();

  private portId: string;

  constructor(
    public sessionId: number,
    portId: string,
    name: string = null,
    sender: chrome.runtime.MessageSender = null,
  ) {
    if (sender) {
      this.sender = sender;
    }

    if (name) {
      this.name = name;
    }

    this.portId = portId;

    ipcRenderer.on(`api-port-postMessage-${portId}`, (e, msg, tab) => {
      if (tab) {
        this.sender.tab = tab;
      }
      this.onMessage.emit(msg, this);
    });
  }

  public disconnect() {
    ipcRenderer.removeAllListeners(`api-port-postMessage-${this.portId}`);
  }

  public postMessage(msg: any) {
    let tab: any = null;
    if (this.sender.tab) {
      tab = getSenderTab();
    }

    ipcRenderer.send(`api-port-postMessage-${this.sessionId}`, {
      portId: this.portId,
      msg,
      tab,
    });
  }
}
