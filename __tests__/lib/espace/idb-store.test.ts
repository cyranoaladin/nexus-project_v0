import { createIdbDraftStore } from '@/lib/espace/client/idb-store';
import type { DraftRecord } from '@/lib/espace/client/sync-engine';

type EventTargetStub = { result?: unknown; error?: Error; onsuccess?: () => void; onerror?: () => void; oncomplete?: () => void; onabort?: () => void };
const original = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

function fakeDb(disk: DraftRecord) {
  const operations: { req: EventTargetStub; tx: EventTargetStub }[] = [];
  const db = { transaction: () => {
    const tx: EventTargetStub & { objectStore?: () => unknown } = {};
    const req: EventTargetStub = { result: disk };
    tx.objectStore = () => ({ get: () => req, put: () => req, delete: () => req });
    operations.push({ req, tx });
    return tx;
  } };
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: { open: () => {
    const req: EventTargetStub = { result: db };
    queueMicrotask(() => req.onsuccess?.());
    return req;
  } } });
  return operations;
}

afterEach(() => { if (original) Object.defineProperty(globalThis, 'indexedDB', original); else Reflect.deleteProperty(globalThis, 'indexedDB'); });
const draft = (answer: string): DraftRecord => ({ baseRevision: 1, lastAcked: {}, pending: { methods: { fields: { correction: answer } } } });

it('attend la validation de transaction, pas seulement le succès provisoire du put', async () => {
  const operations = fakeDb(draft('ancien'));
  const store = createIdbDraftStore();
  let finished = false;
  const writing = store.save('élève:copie', draft('nouveau')).then(() => { finished = true; });
  await tick();
  operations[0].req.onsuccess?.();
  await tick();
  expect(finished).toBe(false);
  operations[0].tx.oncomplete?.();
  await writing;
  expect(finished).toBe(true);
});

it('ne remplace pas le brouillon en mémoire par une ancienne valeur disque après quota dépassé', async () => {
  const operations = fakeDb(draft('ancien'));
  const store = createIdbDraftStore();
  const writing = store.save('élève:copie', draft('réponse récente'));
  await tick();
  operations[0].req.error = new Error('quota');
  operations[0].req.onerror?.();
  await writing;
  const loading = store.load('élève:copie');
  await tick();
  operations[1]?.req.onsuccess?.();
  operations[1]?.tx.oncomplete?.();
  expect(await loading).toEqual(draft('réponse récente'));
});

it('ne ressuscite pas une copie effacée en mémoire quand IndexedDB refuse la suppression', async () => {
  const operations = fakeDb(draft('ancien'));
  const store = createIdbDraftStore();
  const clearing = store.clear('élève:copie');
  await tick();
  operations[0].req.error = new Error('stockage indisponible');
  operations[0].req.onerror?.();
  await clearing;
  const loading = store.load('élève:copie');
  await tick();
  operations[1]?.req.onsuccess?.();
  operations[1]?.tx.oncomplete?.();
  expect(await loading).toBeNull();
});
