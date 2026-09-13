import type { StoreApi } from 'zustand';
import type { PersistOptions, PersistStorage } from 'zustand/middleware';

type OwnedStore<S, P> = Pick<StoreApi<S>, 'getInitialState' | 'setState'> & {
  persist: {
    getOptions(): Partial<PersistOptions<S, P>>;
    setOptions(options: Partial<PersistOptions<S, P>>): void;
    rehydrate(): Promise<void> | void;
  };
};

const owners = new WeakMap<object, { base: string; owner: string; storage: unknown; ready: Promise<void> }>();
const inertStorage = { getItem: (): null => null, setItem: () => {}, removeItem: () => {} };

/** Local drafts are owner-scoped, never an authentication or academic authority. */
export function bindPersistedStoreOwner<S, P>(store: OwnedStore<S, P>, owner: string): Promise<void> {
  if (!owner) throw new Error('A verified draft owner is required');
  const previous = owners.get(store);
  if (previous?.owner === owner) return previous.ready;
  const options = store.persist.getOptions();
  const base = previous?.base ?? options.name;
  const storage = (previous?.storage ?? options.storage) as PersistStorage<P> | undefined;
  if (!base || !storage) throw new Error('Owner-scoped draft storage is unavailable');

  // Reset every field (including exam answers), without overwriting either
  // account's persisted draft. The unowned historical key is left untouched.
  store.persist.setOptions({ storage: inertStorage });
  store.setState(store.getInitialState(), true);
  store.persist.setOptions({ storage, name: `${base}:owner:${encodeURIComponent(owner)}`, skipHydration: true });
  // Zustand's hydration generation rejects late hydration from an older owner.
  const ready = Promise.resolve(store.persist.rehydrate());
  owners.set(store, { base, owner, storage, ready });
  return ready;
}

export function isPersistedStoreOwner(store: object, owner: string): boolean {
  return owners.get(store)?.owner === owner;
}
