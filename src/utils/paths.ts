import { resolve, sep, isAbsolute } from 'path';
import { mkdirSync } from 'fs';
import { remote, app } from 'electron';

export const getPath = (...relativePaths: string[]) => {
  let path: string;

  if (remote) {
    path = remote.app.getPath('userData');
  } else if (app) {
    path = app.getPath('userData');
  } else {
    return null;
  }

  return resolve(path, ...relativePaths).replace(/\\/g, '/');
};

export const mkDirByPathSync = (
  targetDir: any,
  { isRelativeToScript = false } = {},
) => {
  const initDir = isAbsolute(targetDir) ? sep : '';
  const baseDir = isRelativeToScript ? __dirname : '.';

  return targetDir.split(sep).reduce((parentDir: any, childDir: any) => {
    const curDir = resolve(baseDir, parentDir, childDir);
    try {
      mkdirSync(curDir);
    } catch (err) {
      if (err.code === 'EEXIST') {
        return curDir;
      }
      if (err.code === 'ENOENT') {
        throw new Error(`EACCES: permission denied, mkdir '${parentDir}'`);
      }

      const caughtErr = ['EACCES', 'EPERM', 'EISDIR'].indexOf(err.code) > -1;
      if (!caughtErr || (caughtErr && targetDir === curDir)) {
        throw err;
      }
    }

    return curDir;
  }, initDir);
};
