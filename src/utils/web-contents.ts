import { WebContents } from 'electron';

const webContentsToTab = (wc: WebContents) => ({
  id: wc.id,
  index: wc.id,
  windowId: 1,
  highlighted: wc.isFocused(),
  active: wc.isFocused(),
  pined: false,
  discarded: false,
  autoDiscardable: false,
  url: wc.getURL(),
  title: wc.getTitle(),
  incognito: false,
});
