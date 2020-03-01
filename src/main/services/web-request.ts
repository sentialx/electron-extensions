import { ipcMain, WebContents, webContents } from 'electron';
import enhanceWebRequest from '../../models/web-request';
import { makeId } from '../../utils/string';
import { ExtensibleSession } from '..';

const eventListeners: { [key: string]: Function } = {};
const events: { [key: string]: string } = {};

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
    obj[item.name] = item.value;
  });
  return obj;
};

const getCallback = (callback: any) => {
  return function cb(data: any) {
    callback(data);
  };
};

const invokeIpc = (
  wc: WebContents,
  channel: string,
  ...args: any[]
): Promise<any> =>
  new Promise(resolve => {
    const id = makeId(32);

    ipcMain.once(`${channel}-${id}`, (e: any, ...a: any[]) => resolve(...a));

    wc.send(channel, ...args, id);
  });

const interceptRequest = async (
  eventName: string,
  details: any,
  contents: WebContents,
  eventId: number,
  callback: any = null,
) => {
  const response: any = {
    cancel: false,
  };

  const detailsForApi = { ...details };

  if (details.requestHeaders) {
    response.requestHeaders = details.requestHeaders;
    detailsForApi.requestHeaders = objectToArray(details.requestHeaders);
  }

  if (details.responseHeaders) {
    response.responseHeaders = details.responseHeaders;
    detailsForApi.responseHeaders = objectToArray(details.responseHeaders);
  }

  const cb = getCallback(callback);

  const res = await invokeIpc(
    contents,
    `api-webRequest-intercepted-${eventName}-${eventId}`,
    detailsForApi,
  );

  if (res) {
    if (res.cancel === true) {
      return cb({ cancel: true });
    }

    if (res.redirectURL) {
      response.redirectURL = res.redirectURL;
    }

    // TODO(sentialx): it breaks websites with login
    if (res.requestHeaders) {
      response.requestHeaders = {
        ...details.requestHeaders,
        // ...arrayToObject(res.requestHeaders),
      };
    }

    if (res.responseHeaders) {
      response.responseHeaders = {
        ...details.responseHeaders,
        // ...arrayToObject(res.responseHeaders),
      };
    }
  }

  cb(response);
};

export const runWebRequestService = (ses: ExtensibleSession) => {
  const { webRequest } = enhanceWebRequest(ses.session);

  // Handle listener add and remove.

  ipcMain.on('api-add-webRequest-listener', (e: any, data: any) => {
    const { id, name, filters } = data;

    if (
      !Object.getOwnPropertyNames((webRequest as any).webRequest).includes(name)
    )
      return;

    eventListeners[id] = (details: any, callback: any) => {
      interceptRequest(
        name,
        getDetails(details, true),
        webContents.fromId(e.sender.id),
        id,
        callback,
      );
    };

    let res: any;

    if (filters) {
      res = (webRequest as any).addListener(name, filters, eventListeners[id]);
    } else {
      res = (webRequest as any).addListener(
        name,
        { urls: ['<all_urls>'] },
        eventListeners[id],
      );
    }

    events[id] = res.id;
  });

  ipcMain.on('api-remove-webRequest-listener', (e: any, data: any) => {
    const { id, name } = data;

    if (events[id]) {
      (webRequest as any).removeListener(name, events[id]);
      delete events[id];
    }

    if (eventListeners[id]) {
      delete eventListeners[id];
    }
  });
};
