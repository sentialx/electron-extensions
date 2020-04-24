import { ipcRenderer } from 'electron';

const extensionId = chrome?.runtime?.id;

interface IInvokeOptions {
  noop?: boolean;
  noopValue?: any;
  includeExtensionId?: boolean;
}

export const ipcInvoker = (
  name: string,
  { noop, noopValue, includeExtensionId }: IInvokeOptions = {},
) => async (...args: any[]) => {
  const callback =
    typeof args[args.length - 1] === 'function' ? args.pop() : undefined;

  if (noop || typeof noopValue !== 'undefined') {
    if (callback) callback(noopValue);
    return noopValue;
  }

  if (includeExtensionId) {
    args = [extensionId, ...args];
  }

  const result = await ipcRenderer.invoke(name, ...args);

  if (callback) {
    callback(result);
  } else {
    return result;
  }
};
