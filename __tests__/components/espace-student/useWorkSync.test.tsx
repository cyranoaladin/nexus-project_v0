import { act, renderHook, waitFor } from '@testing-library/react';
import { useWorkSync } from '@/components/espace/shared/useWorkSync';
import type { Steps } from '@/lib/espace/client/sync-engine';

const mockStore = { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) };
const mockApi = { save: jest.fn(), submit: jest.fn() };
jest.mock('@/lib/espace/client/idb-store', () => ({ createIdbDraftStore: () => mockStore }));
jest.mock('@/lib/espace/client/api', () => ({ createSaveApi: () => mockApi }));

const props = (userId: string, workId: string, locked = false) => ({ userId, workId, initial: { revision: 1, steps: { methods: { fields: { correction: userId } } } as Steps, lastSavedAt: '2026-10-07T10:00:00Z', locked } });
beforeEach(() => jest.clearAllMocks());

it('remplace les réponses quand l’identité ou le travail change sans démonter la page', async () => {
  const view = renderHook(p => useWorkSync(p), { initialProps: props('élève-A', 'bilan-A') });
  await waitFor(() => expect(view.result.current.steps.methods).toEqual({ fields: { correction: 'élève-A' } }));
  view.rerender(props('élève-B', 'bilan-B'));
  await waitFor(() => expect(view.result.current.steps.methods).toEqual({ fields: { correction: 'élève-B' } }));
  expect(mockStore.load).toHaveBeenCalledWith('élève-A:bilan-A');
  expect(mockStore.load).toHaveBeenCalledWith('élève-B:bilan-B');
});

it('redémarre la synchronisation quand le professeur rouvre un travail', async () => {
  const view = renderHook(p => useWorkSync(p), { initialProps: props('élève-A', 'bilan-A', true) });
  expect(view.result.current.state).toBe('locked');
  view.rerender(props('élève-A', 'bilan-A', false));
  await act(async () => view.result.current.edit('methods', { fields: { correction: 'Reprise demandée' } }));
  expect(view.result.current.steps.methods).toEqual({ fields: { correction: 'Reprise demandée' } });
  expect(mockStore.save).toHaveBeenCalled();
});

it('arrête les écritures dès que de nouvelles propriétés serveur verrouillent le travail', async () => {
  const view = renderHook(p => useWorkSync(p), { initialProps: props('élève-A', 'bilan-A') });
  await act(async () => undefined);
  view.rerender(props('élève-A', 'bilan-A', true));
  await act(async () => view.result.current.edit('methods', { fields: { correction: 'Écriture après remise' } }));
  expect(view.result.current.state).toBe('locked');
  expect(view.result.current.steps.methods).toEqual({ fields: { correction: 'élève-A' } });
});
