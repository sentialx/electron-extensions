# electron-extensions

`electron-extensions` will allow you to use Chrome extensions APIs with Electron.

# Installation

```bash
$ npm install electron-extensions
```

# Usage

The library is really easy-to-use. All you have to do is to put the following code in your main process:

```typescript
import { ExtensibleSession } from 'electron-extensions/main';
import { app } from 'electron';

const extensions = new ExtensibleSession();

(async () => {
  await app.whenReady();
  extensions.loadExtension('C:/.../abcdefghijklmnoprstuwxyz'); // Path to the extension to load
})();
```

# Documentation

## Class `ExtensibleSession` `main`

### `new ExtensibleSession(options: IOptions)`

- `options` object
  - `partition` string - By default `null`. It's used for injecting preloads to
    load `content_scripts` in all webContents within a given Electron `session`. Must be called in `app` `ready` event.
  - `preloadPath` string - Path to content preload script. The option can be useful for bundlers like `webpack` if you're using `CopyWebpackPlugin`.
  - `blacklist` string[] - List of URLs or glob patterns preventing from injecting `content_scripts` to. For example `[wexond://*/*]`.

It's only for the main process. It's used to load extensions and handle their events.

### Instance methods

#### `loadExtension(path: string)`

Loads an extension from a given path.

#### `addWindow(window: Electron.BrowserWindow)`

Adds a BrowserWindow to send and observe UI related events such as

- `chrome.browserAction.onClicked`

### Instance properties

#### `blacklist` string[]

List of URLs or glob patterns preventing from injecting `content_scripts` to. For example `[wexond://*]`.

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
  const tab = createTab(details); // Some create tab method...
  callback(tab.id);
});
```

Returns:

- `details` chrome.tabs.CreateProperties
- `callback` (tabId: number) => void - Must be called with the created tab id as an argument. Also, the `tabId` must be the same as any attached `webContents` id

## Object `extensionsRenderer`

### Usage in `renderer`

```typescript
import { extensionsRenderer } from 'electron-extensions/renderer';
```

### Instance methods

#### `browserAction.onClicked(extensionId: string, tabId: number)`

Emits `chrome.browserAction.onClicked` event in a given extension.
