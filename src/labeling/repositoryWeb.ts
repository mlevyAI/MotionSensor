// IndexedDB-backed example repository for the web/PWA build.
// Stored entirely on-device; nothing leaves the phone.

import { ExampleRepository } from './repository';
import { LabeledExample } from './types';

const DB_NAME = 'motionsensor';
const STORE = 'examples';
const VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

class WebExampleRepository implements ExampleRepository {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    this.db = await openDB();
  }

  private get database(): IDBDatabase {
    if (!this.db) throw new Error('Repository not initialized');
    return this.db;
  }

  async add(example: LabeledExample): Promise<void> {
    await tx(this.database, 'readwrite', (s) => s.put(example));
  }

  async all(): Promise<LabeledExample[]> {
    const items = await tx<LabeledExample[]>(this.database, 'readonly', (s) => s.getAll());
    return items.sort((a, b) => b.createdAt - a.createdAt);
  }

  async remove(id: string): Promise<void> {
    await tx(this.database, 'readwrite', (s) => s.delete(id));
  }

  async clear(): Promise<void> {
    await tx(this.database, 'readwrite', (s) => s.clear());
  }
}

export const exampleRepository: ExampleRepository = new WebExampleRepository();
