import { ipcRenderer } from 'electron';
import { hashCode } from '../utils/string';

export class WebRequestEvent {
  private name: string;
  private listeners: number[] = [];

  constructor(name: string) {
    this.name = name;
  }

  public addListener(callback: Function, filters: string[] = null) {
    const id = hashCode(callback.toString());
    this.listeners.push(id);

    ipcRenderer.on(
      `api-webRequest-intercepted-${this.name}-${id}`,
      (e: any, details: any, requestId: string) => {
        const response = callback(details);

        ipcRenderer.send(
          `api-webRequest-intercepted-${this.name}-${id}-${requestId}`,
          response,
        );
      },
    );

    ipcRenderer.send('api-add-webRequest-listener', {
      id,
      name: this.name,
      filters,
    });
  }

  public removeListener(callback: Function) {
    const id = hashCode(callback.toString());
    this.listeners = this.listeners.filter(c => c !== id);

    ipcRenderer.removeAllListeners(
      `api-webRequest-intercepted-${this.name}-${id}`,
    );

    ipcRenderer.send('api-remove-webRequest-listener', { id, name: this.name });
  }
}
