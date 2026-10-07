/**
 * Brouillons locaux dans IndexedDB (navigateur uniquement).
 *
 * IndexedDB plutôt que localStorage : volume structuré, écritures asynchrones
 * qui ne bloquent pas la frappe, survie aux rafraîchissements. En cas
 * d'indisponibilité (navigation privée, quota), repli en mémoire : le serveur
 * reste la source de vérité et l'indicateur d'enregistrement continue de dire
 * la vérité.
 */
import type { DraftRecord, DraftStore } from './sync-engine';

const DB_NAME = 'nexus-espace';
const STORE = 'drafts';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run<T>(db: IDBDatabase, mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = op(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function createIdbDraftStore(): DraftStore {
  const memory = new Map<string, DraftRecord>();
  let dbPromise: Promise<IDBDatabase | null> | null = null;
  const db = () => (dbPromise ??= typeof indexedDB === 'undefined' ? Promise.resolve(null) : openDb().catch(() => null));

  return {
    async load(key) {
      const handle = await db();
      if (!handle) return memory.get(key) ?? null;
      try {
        return ((await run(handle, 'readonly', (s) => s.get(key))) as DraftRecord | undefined) ?? null;
      } catch {
        return memory.get(key) ?? null;
      }
    },
    async save(key, record) {
      memory.set(key, record);
      const handle = await db();
      if (!handle) return;
      await run(handle, 'readwrite', (s) => s.put(record, key)).catch(() => undefined);
    },
    async clear(key) {
      memory.delete(key);
      const handle = await db();
      if (!handle) return;
      await run(handle, 'readwrite', (s) => s.delete(key)).catch(() => undefined);
    },
  };
}
