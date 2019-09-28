import { IpcExtension } from '../models/ipc-extension';
import { replaceAll } from '../utils/string';

export const getI18n = (extension: IpcExtension) => ({
  getAcceptLanguages: (cb: any) => {
    if (cb) {
      cb(navigator.languages);
    }
  },
  getMessage: (messageName: string, substitutions?: any) => {
    if (messageName === '@@ui_locale') return 'en_US';

    const { locale } = extension;
    const substitutionsArray = substitutions instanceof Array;

    const item = locale[messageName];

    if (item == null) return '';
    if (substitutionsArray && substitutions.length >= 9) return null;

    let message = item.message;

    if (typeof item.placeholders === 'object') {
      for (const placeholder in item.placeholders) {
        message = replaceAll(
          message,
          `$${placeholder}$`,
          item.placeholders[placeholder].content,
        );
      }
    }

    if (substitutionsArray) {
      for (let i = 0; i < 9; i++) {
        message = replaceAll(message, `$${i + 1}`, substitutions[i] || ' ');
      }
    }

    return message;
  },

  getUILanguage: () => {
    return navigator.language;
  },

  detectLanguage: (text: string, cb: any) => {
    // TODO
    if (cb) {
      cb({
        isReliable: false,
        languages: [],
      });
    }
  },
});
