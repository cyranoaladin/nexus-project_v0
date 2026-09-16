import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { SessionRecoveryProvider } from '@/components/auth/SessionRecoveryProvider';
import { useNsiProgress } from '@/hooks/useNsiProgress';
import { useEAMProgress } from '@/hooks/useEAMProgress';
import { useProgressionSync } from '@/app/programme/maths-1ere/hooks/useProgressionSync';
import { useMathsLabStore } from '@/app/programme/maths-1ere/store';
import MathsTerminaleClient from '@/app/programme/maths-terminale/components/MathsTerminaleClient';
import { useMathsTerminaleStore } from '@/app/programme/maths-terminale/store';

const router = { replace: jest.fn(), refresh: jest.fn() };
const search = new URLSearchParams();
let mockPathname = '/dashboard/eleve';
jest.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => mockPathname, useSearchParams: () => search }));
const session = (id: string) => ({ user: { id, email: `${id}@example.test`, role: 'ELEVE' }, expires: '2099-01-01T00:00:00Z' });
const progress = (subject: number) => ({ subjects: { [subject]: { status: 'read', lastWorkedAt: '2026-01-01T00:00:00Z' } }, patterns: {}, flashcards: {}, fiveDayPlan: {}, selfAssessment: {}, mockExams: [], oralPhrases: {} });
const response = (body: unknown) => ({ ok: true, json: async () => body }) as Response;
const originalFetch = global.fetch;
beforeEach(() => { mockPathname = '/dashboard/eleve'; });
afterEach(() => { global.fetch = originalFetch; localStorage.clear(); jest.useRealTimers(); });

function Probe() {
  const { progress: value } = useNsiProgress();
  return <output aria-label="Progress">{JSON.stringify(value)}</output>;
}

it('a late A hydration cannot overwrite B local storage or send A progress using B credentials', async () => {
  let current = session('synthetic-a');
  (useSession as jest.Mock).mockImplementation(() => ({ data: current, status: 'authenticated' }));
  let finishA!: (value: Response) => void;
  const mutations: unknown[] = [];
  global.fetch = jest.fn(async (input, init) => {
    if (input === '/api/auth/session') return response(current);
    if (init?.method === 'PUT') { mutations.push(JSON.parse(String(init.body))); return response({ updatedAt: 'now' }); }
    if (current.user.id === 'synthetic-a') return new Promise<Response>(resolve => { finishA = resolve; });
    return response({ data: progress(2), updatedAt: 'now' });
  });
  const view = render(<SessionRecoveryProvider><Probe /></SessionRecoveryProvider>);
  await waitFor(() => expect(finishA).toBeDefined());
  current = session('synthetic-b');
  view.rerender(<SessionRecoveryProvider><Probe /></SessionRecoveryProvider>);
  await waitFor(() => expect(screen.getByLabelText('Progress')).toHaveTextContent('"2"'));
  const bKey = 'nsi-pratique-2026-progress:synthetic-b@example.test';
  const before = localStorage.getItem(bKey);
  await act(async () => { finishA(response({ data: progress(1), updatedAt: 'old' })); });
  expect(localStorage.getItem(bKey)).toBe(before);
  expect(screen.getByLabelText('Progress')).not.toHaveTextContent('"1"');
  expect(mutations).toEqual([]);
});

function EamDraft() {
  const { toggleCheck, state } = useEAMProgress();
  return <><output aria-label="EAM draft">{JSON.stringify(state)}</output><button onClick={() => toggleCheck('synthetic-check')}>Change EAM draft</button></>;
}

function NsiDraft() {
  const { setSubjectProgress, progress: value } = useNsiProgress();
  return <><output aria-label="NSI draft">{JSON.stringify(value)}</output><button onClick={() => setSubjectProgress(1, { status: 'read' })}>Change NSI draft</button></>;
}

it.each(['NSI', 'EAM'] as const)('%s hydrates after client navigation verification and preserves its edited draft through later unavailability', async kind => {
  const current = session(`navigation-${kind.toLowerCase()}`);
  (useSession as jest.Mock).mockReturnValue({ data: current, status: 'authenticated' });
  const Component = kind === 'NSI' ? NsiDraft : EamDraft;
  const remote = kind === 'NSI' ? progress(2) : { checks: { 'remote-check': true }, quiz: {}, lastUpdated: '2026-01-01T00:00:00Z' };
  let holdVerification = false;
  let verify!: (value: Response) => void;
  let reads = 0;
  const mutations: unknown[] = [];
  global.fetch = jest.fn(async (input, init) => {
    if (input === '/api/auth/session') return holdVerification ? new Promise<Response>(resolve => { verify = resolve; }) : response(current);
    if (init?.method && init.method !== 'GET') { mutations.push(init.body); return response({ updatedAt: 'now' }); }
    reads++;
    return response({ data: remote, updatedAt: 'now' });
  });
  const view = render(<SessionRecoveryProvider><div>Verified previous protected route</div></SessionRecoveryProvider>);
  await waitFor(() => expect(document.querySelector('[data-session-observation]')).toHaveAttribute('data-session-observation', 'AUTHENTICATED'));
  holdVerification = true;
  mockPathname = kind === 'NSI' ? '/dashboard/eleve/nsi-pratique-2026' : '/dashboard/eleve/eam';
  view.rerender(<SessionRecoveryProvider><Component /></SessionRecoveryProvider>);
  await waitFor(() => expect(document.querySelector('[data-session-observation]')).toHaveAttribute('data-session-observation', 'RECOVERING'));
  expect(reads).toBe(0);
  await act(async () => { verify(response(current)); });
  await waitFor(() => expect(screen.getByLabelText(`${kind} draft`)).toHaveTextContent(kind === 'NSI' ? '"2"' : 'remote-check'));
  expect(reads).toBe(1);

  jest.useFakeTimers();
  fireEvent.click(screen.getByRole('button', { name: `Change ${kind} draft` }));
  const edited = screen.getByLabelText(`${kind} draft`).textContent;
  (useSession as jest.Mock).mockReturnValue({ data: null, status: 'unauthenticated' });
  view.rerender(<SessionRecoveryProvider><Component /></SessionRecoveryProvider>);
  await act(async () => { jest.advanceTimersByTime(10_000); });
  expect(document.querySelector('[data-session-observation]')).toHaveAttribute('data-session-observation', 'UNAVAILABLE');
  expect(screen.getByLabelText(`${kind} draft`).textContent).toBe(edited);
  (useSession as jest.Mock).mockReturnValue({ data: current, status: 'authenticated' });
  view.rerender(<SessionRecoveryProvider><Component /></SessionRecoveryProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Réessayer la vérification' }));
  await act(async () => { verify(response(current)); });
  await act(async () => { jest.advanceTimersByTime(2000); });
  expect(document.querySelector('[data-session-observation]')).toHaveAttribute('data-session-observation', 'AUTHENTICATED');
  expect(screen.getByLabelText(`${kind} draft`).textContent).toBe(edited);
  expect(reads).toBe(1);
  expect(mutations).toEqual([]);
});

it.each(['NSI', 'EAM'] as const)('%s resumes an interrupted initial progress read without applying its stale result', async kind => {
  const current = session(`initial-read-${kind.toLowerCase()}`);
  (useSession as jest.Mock).mockReturnValue({ data: current, status: 'authenticated' });
  const Component = kind === 'NSI' ? NsiDraft : EamDraft;
  const remote = kind === 'NSI' ? progress(2) : { checks: { 'current-check': true }, quiz: {}, lastUpdated: '2026-01-01T00:00:00Z' };
  let finishInitialRead!: (value: Response) => void;
  let reads = 0;
  global.fetch = jest.fn(async input => {
    if (input === '/api/auth/session') return response(current);
    reads++;
    if (reads === 1) return new Promise<Response>(resolve => { finishInitialRead = resolve; });
    return response({ data: remote, updatedAt: 'now' });
  });
  const view = render(<SessionRecoveryProvider><Component /></SessionRecoveryProvider>);
  await waitFor(() => expect(finishInitialRead).toBeDefined());
  (useSession as jest.Mock).mockReturnValue({ data: null, status: 'unauthenticated' });
  view.rerender(<SessionRecoveryProvider><Component /></SessionRecoveryProvider>);
  (useSession as jest.Mock).mockReturnValue({ data: current, status: 'authenticated' });
  await act(async () => { view.rerender(<SessionRecoveryProvider><Component /></SessionRecoveryProvider>); });
  await waitFor(() => expect(screen.getByLabelText(`${kind} draft`)).toHaveTextContent(kind === 'NSI' ? '"2"' : 'current-check'));
  expect(reads).toBe(2);
  const hydrated = screen.getByLabelText(`${kind} draft`).textContent;
  await act(async () => { finishInitialRead(response({ data: kind === 'NSI' ? progress(1) : { checks: { 'stale-check': true }, quiz: {}, lastUpdated: '2026-01-01T00:00:00Z' } })); });
  expect(screen.getByLabelText(`${kind} draft`).textContent).toBe(hydrated);
});

it('merges NSI edits made while initial server hydration is pending', async () => {
  const current = session('nsi-hydration-draft');
  (useSession as jest.Mock).mockReturnValue({ data: current, status: 'authenticated' });
  let finishRead!: (value: Response) => void;
  global.fetch = jest.fn(async (input, init) => {
    if (input === '/api/auth/session') return response(current);
    if (init?.method === 'PUT') return response({ updatedAt: 'now' });
    return new Promise<Response>(resolve => { finishRead = resolve; });
  });
  render(<SessionRecoveryProvider><NsiDraft /></SessionRecoveryProvider>);
  await waitFor(() => expect(finishRead).toBeDefined());
  jest.useFakeTimers();
  fireEvent.click(screen.getByRole('button', { name: 'Change NSI draft' }));
  expect(screen.getByLabelText('NSI draft')).toHaveTextContent('"1"');
  await act(async () => { finishRead(response({ data: progress(2), updatedAt: 'now' })); });
  const stored = JSON.parse(localStorage.getItem('nsi-pratique-2026-progress:nsi-hydration-draft@example.test')!);
  expect(stored.subjects).toMatchObject({ 1: { status: 'read' }, 2: { status: 'read' } });
  expect(screen.getByLabelText('NSI draft')).toHaveTextContent('"1"');
  expect(screen.getByLabelText('NSI draft')).toHaveTextContent('"2"');
});

it('does not replay a pre-recovery NSI pending draft when the document exits after recovery', async () => {
  const current = session('nsi-exit');
  (useSession as jest.Mock).mockReturnValue({ data: current, status: 'authenticated' });
  const mutations: unknown[] = [];
  global.fetch = jest.fn(async (input, init) => {
    if (input === '/api/auth/session') return response(current);
    if (init?.method === 'PUT') mutations.push(init.body);
    return response({ data: null, updatedAt: null });
  });
  const view = render(<SessionRecoveryProvider><NsiDraft /></SessionRecoveryProvider>);
  await waitFor(() => expect(document.querySelector('[data-session-observation]')).toHaveAttribute('data-session-observation', 'AUTHENTICATED'));
  jest.useFakeTimers();
  fireEvent.click(screen.getByRole('button', { name: 'Change NSI draft' }));
  (useSession as jest.Mock).mockReturnValue({ data: null, status: 'unauthenticated' });
  view.rerender(<SessionRecoveryProvider><NsiDraft /></SessionRecoveryProvider>);
  (useSession as jest.Mock).mockReturnValue({ data: current, status: 'authenticated' });
  await act(async () => { view.rerender(<SessionRecoveryProvider><NsiDraft /></SessionRecoveryProvider>); });
  expect(document.querySelector('[data-session-observation]')).toHaveAttribute('data-session-observation', 'AUTHENTICATED');
  fireEvent(window, new Event('beforeunload'));
  expect(mutations).toEqual([]);
  expect(localStorage.getItem('nsi-pratique-2026-progress:nsi-exit@example.test')).toContain('read');
});

it('does not send a queued EAM autosave after session verification becomes uncertain', async () => {
  const current = session('synthetic-a');
  (useSession as jest.Mock).mockReturnValue({ data: current, status: 'authenticated' });
  let unavailable = false;
  const mutations: unknown[] = [];
  global.fetch = jest.fn(async (input, init) => {
    if (input === '/api/auth/session') return unavailable ? new Promise<Response>(() => {}) : response(current);
    if (init?.method === 'POST') mutations.push(init.body);
    return response({ data: null });
  });
  const view = render(<SessionRecoveryProvider><EamDraft /></SessionRecoveryProvider>);
  await waitFor(() => expect(document.querySelector('[data-session-observation]')).toHaveAttribute('data-session-observation', 'AUTHENTICATED'));
  jest.useFakeTimers();
  fireEvent.click(screen.getByRole('button', { name: 'Change EAM draft' }));
  unavailable = true;
  (useSession as jest.Mock).mockReturnValue({ data: null, status: 'unauthenticated' });
  view.rerender(<SessionRecoveryProvider><EamDraft /></SessionRecoveryProvider>);
  await act(async () => { jest.advanceTimersByTime(10_000); });
  expect(mutations).toEqual([]);
  expect(localStorage.getItem('nexus_eam_progress_synthetic-a')).toContain('synthetic-check');
});
function MathsDraft({ owner }: { owner: string }) {
  const { isHydrating } = useProgressionSync(owner);
  const xp = useMathsLabStore(state => state.totalXP);
  return <output aria-label="Maths progress">{isHydrating ? 'loading' : xp}</output>;
}

it('a late Premiere hydration cannot seed another account or post the previous account draft', async () => {
  let current = session('maths-a');
  (useSession as jest.Mock).mockImplementation(() => ({ data: current, status: 'authenticated' }));
  useMathsLabStore.setState({ totalXP: 777, exerciseResults: { privateA: [9] } });
  let finishA!: (value: Response) => void;
  const mutations: unknown[] = [];
  global.fetch = jest.fn(async (input, init) => {
    if (input === '/api/auth/session') return response(current);
    if (init?.method === 'POST') { mutations.push(JSON.parse(String(init.body))); return response({ ok: true }); }
    if (current.user.id === 'maths-a') return new Promise<Response>(resolve => { finishA = resolve; });
    return response({ ok: true, data: null });
  });
  const view = render(<SessionRecoveryProvider><MathsDraft owner={current.user.id} /></SessionRecoveryProvider>);
  await waitFor(() => expect(finishA).toBeDefined());
  current = session('maths-b');
  view.rerender(<SessionRecoveryProvider><MathsDraft owner={current.user.id} /></SessionRecoveryProvider>);
  await waitFor(() => expect(screen.getByLabelText('Maths progress')).not.toHaveTextContent('loading'));
  expect(useMathsLabStore.getState().exerciseResults).toEqual({});
  expect(useMathsLabStore.getState().totalXP).not.toBe(777);
  await act(async () => { finishA(response({ ok: true, data: { total_xp: 999, exercise_results: { privateA: [8] } } })); });
  expect(useMathsLabStore.getState().exerciseResults).toEqual({});
  expect(mutations).not.toEqual(expect.arrayContaining([expect.objectContaining({ total_xp: 777 })]));
});
it('Terminale loads only the current owner before enabling any autosave', async () => {
  const current = session('terminale-b');
  (useSession as jest.Mock).mockReturnValue({ data: current, status: 'authenticated' });
  useMathsTerminaleStore.setState({ totalXP: 777, exerciseResults: { privateA: [9] } });
  let finishRead!: (value: Response) => void;
  const mutations: unknown[] = [];
  global.fetch = jest.fn(async (input, init) => {
    if (input === '/api/auth/session') return response(current);
    if (init?.method === 'POST') { mutations.push(JSON.parse(String(init.body))); return response({ ok: true }); }
    return new Promise<Response>(resolve => { finishRead = resolve; });
  });
  render(<SessionRecoveryProvider><MathsTerminaleClient userId={current.user.id} initialDisplayName="Synthetic B" /></SessionRecoveryProvider>);
  await waitFor(() => expect(finishRead).toBeDefined());
  expect(mutations).toEqual([]);
  await act(async () => { finishRead(response({ ok: true, data: null })); });
  expect(useMathsTerminaleStore.getState().exerciseResults).toEqual({});
  expect(useMathsTerminaleStore.getState().totalXP).toBe(0);
});
jest.unmock('@/components/auth/SessionRecoveryProvider');
