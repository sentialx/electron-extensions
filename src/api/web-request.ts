import { WebRequestEvent } from '../models/web-request-event';

export const getWebRequest = () => ({
  ResourceType: {
    CSP_REPORT: 'csp_report',
    FONT: 'font',
    IMAGE: 'image',
    MAIN_FRAME: 'main_frame',
    MEDIA: 'media',
    OBJECT: 'object',
    OTHER: 'other',
    PING: 'ping',
    SCRIPT: 'script',
    STYLESHEET: 'stylesheet',
    SUB_FRAME: 'sub_frame',
    WEBSOCKET: 'websocket',
    XMLHTTPREQUEST: 'xmlhttprequest',
  },

  onBeforeRequest: new WebRequestEvent('onBeforeRequest'),
  onBeforeSendHeaders: new WebRequestEvent('onBeforeSendHeaders'),
  onHeadersReceived: new WebRequestEvent('onHeadersReceived'),
  onSendHeaders: new WebRequestEvent('onSendHeaders'),
  onResponseStarted: new WebRequestEvent('onResponseStarted'),
  onBeforeRedirect: new WebRequestEvent('onBeforeRedirect'),
  onCompleted: new WebRequestEvent('onCompleted'),
  onErrorOccurred: new WebRequestEvent('onErrorOccurred'),
});
