import { bindPersistedStoreOwner } from '@/lib/auth/session-owned-store';
import { useMathsLabStore } from '@/app/programme/maths-1ere/store';
import { useMathsTerminaleStore } from '@/app/programme/maths-terminale/store';

beforeEach(() => { localStorage.clear(); });

it.each([
  ['premiere', useMathsLabStore, (owner: string) => bindPersistedStoreOwner(useMathsLabStore, owner), (value: { totalXP: number; exerciseResults?: Record<string, number[]> }) => useMathsLabStore.setState(value)],
  ['terminale', useMathsTerminaleStore, (owner: string) => bindPersistedStoreOwner(useMathsTerminaleStore, owner), (value: { totalXP: number; exerciseResults?: Record<string, number[]> }) => useMathsTerminaleStore.setState(value)],
] as const)('%s never hydrates an ownerless cache automatically and resets the complete state for B', async (_label, store, bind, set) => {
  expect(store.persist.getOptions().skipHydration).toBe(true);
  const legacyKey = store.persist.getOptions().name!;
  const unowned = JSON.stringify({ state: { totalXP: 999 }, version: store.persist.getOptions().version });
  localStorage.setItem(legacyKey, unowned);
  await bind('synthetic-a');
  set({ totalXP: 123, exerciseResults: { privateA: [9] } });
  await bind('synthetic-b');
  expect(store.getState().totalXP).toBe(0);
  expect(store.getState().exerciseResults).toEqual({});
  expect(localStorage.getItem(legacyKey)).toBe(unowned);
  set({ totalXP: 456 });
  await bind('synthetic-a');
  expect(store.getState().totalXP).toBe(123);
  expect(store.getState().exerciseResults).toEqual({ privateA: [9] });
});

it('also retires Premiere exam answers and remote-write flags on owner change', async () => {
  await bindPersistedStoreOwner(useMathsLabStore, 'exam-a');
  const initial = useMathsLabStore.getInitialState();
  useMathsLabStore.setState({ isHydrated: true, canWriteRemote: true, examState: { ...initial.examState, autoStates: { privateA: { reponse: 'draft', revealed: false } } } });
  await bindPersistedStoreOwner(useMathsLabStore, 'exam-b');
  expect(useMathsLabStore.getState().examState).toEqual(initial.examState);
  expect(useMathsLabStore.getState().canWriteRemote).toBe(false);
});
