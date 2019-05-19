# electron-extensions

`electron-extensions` will allow you to use Chrome extensions APIs with Electron.

# Installation

```bash
$ npm install electron-extensions
```

# Usage

The library is really easy-to-use. All you will have to do is to put the following code in your main process:

```typescript
import { ExtensionsMain } from 'electron-extensions';
import { app, session } from 'electron';

const extensions = new ExtensionsMain(session.defaultSession);

app.on('ready', () => {
  ...
  extensions.setSession(session.defaultSession);
  extensions.load('C:/.../abcdefghijklmnoprstuwxyz'); // Path to the extension to load
  ...
});

```

# Documentation

## Class `ExtensionsMain`

It's only for the main process. It's used to load extensions and handle their events.

### `new ExtensionsMain()`

The constructor must be called before `app` is ready.

### Instance methods

#### `setSession(session: Electron.Session)`

`session` is used for injecting preloads to load `content_scripts` in all webContents within a given Electron `session`. Must be called in `app` `ready` event.

#### `load(path: string)`

Loads an extension from a given path.
