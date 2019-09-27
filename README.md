# electron-extensions

`electron-extensions` will allow you to use Chrome extensions APIs with Electron.

# Installation

```bash
$ npm install electron-extensions
```

# Usage

The library is really easy-to-use. All you have to do is to put the following code in your main process:

```typescript
import { ExtensibleSession } from 'electron-extensions';
import { app, session } from 'electron';

app.on('ready', () => {
  ...
  const extensions = new ExtensibleSession(session.defaultSession);
  extensions.loadExtension('C:/.../abcdefghijklmnoprstuwxyz'); // Path to the extension to load
  ...
});

```

# Documentation

## Class `ExtensibleSession`

### `new ExtensibleSession(session: Electron.Session)`

- `session` Electron.Session - used for injecting preloads to load `content_scripts` in all webContents within a given Electron `session`. Must be called in `app` `ready` event.

If the `webContents` are in multiple `BrowserWindows`, the `--window-id=<the BrowserWindow id>` additional argument should be passed to the `webContents`.
For reference see [`the Electron documentation`](https://electronjs.org/docs/api/browser-window#new-browserwindowoptions).

For example:
```js
{
  webPreferences: {
    additionalArguments: ['--window-id=1'],
  },
}
```

If you want to prevent injecting `content_scripts` to some URLs that start with a specified string, use `--blacklist=`.

For example:
```js
{
  webPreferences: {
    additionalArguments: ['--blacklist=["wexond://"]'],
  },
}
```

It means all URLs starting with `wexond://` should be protected from injecting `content_scripts`.

It's only for the main process. It's used to load extensions and handle their events.

### Instance methods

#### `loadExtension(path: string)`

Loads an extension from a given path.

#### `addWindow(window: Electron.BrowserWindow)`

Adds a BrowserWindow to send and observe UI related events such as `chrome.browserAction.setBadgeText` or `chrome.browserAction.onClicked`.

## Object `extensionsRenderer`

### Usage in `renderer`

```typescript
import { extensionsRenderer } from 'electron-extensions';
```

### Instance methods

#### `browserAction.onClicked(extensionId: string, tabId: number)`

Sends `chrome.browserAction.onClicked` event to a given extension.

### Events

#### `set-badge-text`

Emitted when `chrome.browserAction.setBadgeText` has been called in an extension.

Returns:
- `extensionId` string
- `details` chrome.browserAction.BadgeTextDetails

#### `create-tab`

Emitted when `chrome.tabs.create` has been called in an extension.

##### Example:

```typescript
import { extensionsRenderer } from 'electron-extensions';

extensionsRenderer.on('create-tab', (details, callback) => {
  const tab = createTab(details) // Some create tab method...
  callback(tab.id);
})
```

Returns:
- `details` chrome.tabs.CreateProperties
- `callback` (tabId: number) => void - Must be called with the created tab id as an argument. Also, the `tabId` must be the same as any attached `webContents` id
