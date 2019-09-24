import { mkDirByPathSync } from '../utils/paths';
import { makeId } from '../utils/string';
import { EventEmitter } from 'events';
import { promises, existsSync } from 'fs';

export class StorageArea extends EventEmitter {
  private path: string;

  private queue: string[] = [];

  constructor(path: string) {
    super();

    this.path = path;

    mkDirByPathSync(path);

    if (!existsSync(path)) {
      this.clear();
    }
  }

  private async _save(content: string) {
    try {
      await promises.writeFile(
        this.path,
        content,
      );

      if (this.queue.length >= 3) {
        for (let i = this.queue.length - 1; i > 0; i--) {
          this.removeAllListeners(this.queue[i]);
          this.queue.splice(i, 1);
        }
      } else {
        this.queue.splice(0, 1);
      }

      if (this.queue[0]) {
        this.emit(this.queue[0]);
      }
    } catch (e) {
      console.error(e);
    }
  }

  public async save(content: string) {
    const id = makeId(32);

    this.queue.push(id);

    if (this.queue.length === 1) {
      this._save(content);
    } else {
      this.once(id, () => {
        this._save(content);
      });
    }
  }

  public async get(query: any): Promise<any> {
    try {
      if (query === null || query === undefined) {
        const result: any = {};
  
        const data = JSON.parse(await promises.readFile(this.path, 'utf8'))
  
        for (const key in data) {
          result[key] = data[key];
        }
        
        return result;
      } else if (Array.isArray(query)) {
        const result: any = {};
  
        const data = JSON.parse(await promises.readFile(this.path, 'utf8'))
  
        for (const key in data) {
          for (const key1 of query) {
            if (key === key1) {
              result[key] = data[key];
            }
          }
        }
        
        return result;
      } else if (typeof query === 'object') {
        const result: any = { ...query };
  
        const data = JSON.parse(await promises.readFile(this.path, 'utf8'))
  
        for (const key in data) {
          for (const key1 in query) {
            if (key1 === key && data[key] !== undefined) {
              result[key] = data[key];
            }
          }
        }
  
        return result;
      } else if (typeof query === 'string') {
        const data = JSON.parse(await promises.readFile(this.path, 'utf8'))
  
        for (const key in data) {
          if (key === query) {
            return { [query]: data[key] };
          }
        }
  
        return {};
      } else {
        return {};
      }
    } catch (e) {
      return {};
    }
  }

  public async set(items: any): Promise<void> {
    if (items === Object(items)) {
      const newData: any = this.get(null);

      for (const key in items) {
        if (items[key] === undefined) {
          delete newData[key];
        } else {
          newData[key] = items[key];
        }
        
      }

      await this.save(JSON.stringify(newData));
    }
  }

  public async remove(keys: any): Promise<void> {
    if (typeof keys === 'string') {
      await this.set({ [keys]: undefined });
    } else if (Array.isArray(keys)) {
      for (const key of keys) {
        await this.set({ [key]: undefined });
      }
    } else {
      // error
    }
  }

  public async clear(): Promise<void> {
    await this.save('{}');
  }
}
