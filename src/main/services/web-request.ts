import { ipcMain, Session, WebContents, webContents } from 'electron';
import enhanceWebRequest from 'electron-better-web-request';
import { makeId } from '../../utils/string';

const eventListeners: { [key: string]: Function } = {};

const getRequestType = (type: string): any => {
  if (type === 'mainFrame') return 'main_frame';
  if (type === 'subFrame') return 'sub_frame';
  if (type === 'cspReport') return 'csp_report';
  return type;
};

const getDetails = (details: any, isTabRelated: boolean) => {
  const newDetails = {
    ...details,
    requestId: details.id.toString(),
    frameId: 0,
    parentFrameId: -1,
    type: getRequestType(details.resourceType),
    timeStamp: Date.now(),
    tabId: isTabRelated ? details.webContentsId : -1,
    error: '',
  };

  return newDetails;
};

const objectToArray = (obj: any): any[] => {
  const arr: any = [];
  Object.keys(obj).forEach(k => {
    if (obj[k]) {
      arr.push({ name: k, value: obj[k][0] });
    }
  });
  return arr;
};

const arrayToObject = (arr: any[]) => {
  const obj: any = {};
  arr.forEach((item: any) => {
    arr[item.name] = item.value;
  });
  return obj;
};

const getCallback = (callback: any) => {
  return function cb(data: any) {
    if (!cb.prototype.callbackCalled) {
      callback(data);
      cb.prototype.callbackCalled = true;
    }
  };
};

const interceptRequest = (
  eventName: string,
  details: any,
  contents: WebContents,
  eventId: number,
  callback: any = null,
) => {
  let isIntercepted = false;

  const defaultRes = {
    cancel: false,
    requestHeaders: details.requestHeaders,
    responseHeaders: details.responseHeaders,
  };

  const cb = getCallback(callback);

  const id = makeId(32);

  ipcMain.once(
    `api-webRequest-response-${eventName}-${eventId}-${id}`,
    (e: any, res: any) => {
      if (res) {
        if (res.cancel) {
          return cb({ cancel: true });
        }

        if (res.redirectURL) {
          return cb({
            cancel: false,
            redirectURL: res.redirectUrl,
          });
        }

        if (
          res.requestHeaders &&
          (eventName === 'onBeforeSendHeaders' || eventName === 'onSendHeaders')
        ) {
          const requestHeaders = arrayToObject(res.requestHeaders);
          return cb({ cancel: false, requestHeaders });
        }

        if (res.responseHeaders) {
          const responseHeaders = {
            ...details.responseHeaders,
            ...arrayToObject(res.responseHeaders),
          };

          return cb({
            responseHeaders,
            cancel: false,
          });
        }
      }

      cb(defaultRes);
    },
  );

  contents.send(
    `api-webRequest-intercepted-${eventName}-${eventId}`,
    details,
    id,
  );

  isIntercepted = true;

  if (!isIntercepted && callback) {
    cb(defaultRes);
  }
};

export const runWebRequestService = (ses: Session) => {
  const { webRequest } = enhanceWebRequest(ses);

  // Handle listener add and remove.

  ipcMain.on('api-add-webRequest-listener', (e: any, data: any) => {
    const { id, name, filters } = data;

    eventListeners[id] = (details: any, callback: any) => {
      let newDetails = getDetails(details, true);
      if (name === 'onBeforeSendHeaders') {
        const requestHeaders = objectToArray(details.requestHeaders);

        newDetails = {
          ...newDetails,
          requestHeaders,
        };
      } else if (name === 'onHeadersReceived') {
        const responseHeaders = objectToArray(details.responseHeaders);

        newDetails = {
          ...newDetails,
          responseHeaders,
        };
      } else if (name === 'onSendHeaders') {
        const requestHeaders = objectToArray(details.requestHeaders);

        newDetails = {
          ...newDetails,
          requestHeaders,
        };
      }

      interceptRequest(
        name,
        newDetails,
        webContents.fromId(e.sender.id),
        id,
        callback,
      );
    };

    if (filters) {
      (webRequest as any)[name](filters, eventListeners[id]);
    } else {
      (webRequest as any)[name]({ urls: ['<all_urls>'] }, eventListeners[id]);
    }
  });

  ipcMain.on('api-remove-webRequest-listener', (e: any, data: any) => {
    const { id } = data;
    if (eventListeners[id]) {
      delete eventListeners[id];
    }
  });
};
