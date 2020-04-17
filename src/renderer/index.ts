import { injectAPI } from './api';

(async () => {
  if (!location.href.startsWith('chrome-extension://')) return;
  injectAPI();
})();
