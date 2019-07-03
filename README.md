# electron-extensions

`electron-extensions` will allow you to use Chrome extensions APIs with Electron.

# Installation

```bash
$ npm install electron-extensions
```

# Usage

The library is really easy-to-use. All you will have to do is to put the following code in your main process:

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

It's only for the main process. It's used to load extensions and handle their events.

### Instance methods

#### `loadExtension(path: string)`

Loads an extension from a given path.
