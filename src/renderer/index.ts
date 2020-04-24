import { injectAPI } from './api';
import { PROTOCOL_SCHEME } from '../constants';

(async () => {
  if (!location.href.startsWith(PROTOCOL_SCHEME)) return;
  (process as any).once('document-start', () => {
    injectAPI();
  });
})();
