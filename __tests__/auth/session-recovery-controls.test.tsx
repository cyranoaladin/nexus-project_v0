import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { SessionRecoveryProvider, useProtectedFetch } from '@/components/auth/SessionRecoveryProvider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

jest.unmock('framer-motion');

const search = new URLSearchParams();
let mockPathname = '/dashboard/admin';
const router = { replace: jest.fn(), refresh: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => mockPathname, useSearchParams: () => search }));
const session = { user: { id: 'synthetic-admin', role: 'ADMIN' }, expires: '2099-01-01T00:00:00Z' };
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; mockPathname = '/dashboard/admin'; jest.useRealTimers(); });

it('honors disabled on asChild links including their own action handlers', () => {
  const action = jest.fn();
  render(<Button disabled asChild><a href="#action" onClick={action}>Apply mutation</a></Button>);
  fireEvent.click(screen.getByRole('link', { name: 'Apply mutation' }));
  expect(action).not.toHaveBeenCalled();
});

function ModalDraft() {
  const [draft, setDraft] = useState('');
  return <Dialog defaultOpen><DialogContent aria-describedby={undefined}>
    <DialogTitle>Draft editor</DialogTitle>
    <input aria-label="Modal draft" value={draft} onChange={event => setDraft(event.target.value)} />
    <button>Save sensitive change</button>
  </DialogContent></Dialog>;
}

it('preserves the mounted modal draft and offers usable recovery controls inside its focus trap', async () => {
  (useSession as jest.Mock).mockReturnValue({ data: session, status: 'authenticated' });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => session });
  const view = render(<SessionRecoveryProvider><ModalDraft /></SessionRecoveryProvider>);
  await waitFor(() => expect(document.querySelector('[data-session-observation]')).toHaveAttribute('data-session-observation', 'AUTHENTICATED'));
  const input = screen.getByLabelText('Modal draft');
  fireEvent.change(input, { target: { value: 'private unsaved draft' } });
  jest.useFakeTimers();
  global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));
  (useSession as jest.Mock).mockReturnValue({ data: null, status: 'unauthenticated' });
  view.rerender(<SessionRecoveryProvider><ModalDraft /></SessionRecoveryProvider>);
  await act(async () => { jest.advanceTimersByTime(10_000); });
  expect(screen.getByLabelText('Modal draft')).toBe(input);
  expect(input).toHaveValue('private unsaved draft');
  expect(screen.getByRole('button', { name: 'Save sensitive change' })).toBeDisabled();
  expect(screen.getByRole('dialog')).toHaveTextContent('momentanément indisponible');
  expect(screen.getByRole('button', { name: 'Réessayer la vérification' })).not.toBeDisabled();
  expect(screen.getByRole('button', { name: 'Se déconnecter' })).not.toBeDisabled();
  expect(router.replace).not.toHaveBeenCalled();
});

function MutationProbe() {
  const guardedFetch = useProtectedFetch();
  const [result, setResult] = useState('unsaved');
  return <><button onClick={async () => {
    try {
      const response = await guardedFetch('/api/synthetic-mutation', { method: 'POST' });
      await response.json();
      setResult('success');
    } catch { setResult('verification required'); }
  }}>Save form</button><output>{result}</output></>;
}

it('cannot report a stale mutation success after the response body crosses a recovery boundary', async () => {
  let unavailable = false;
  let finishBody!: (value: unknown) => void;
  (useSession as jest.Mock).mockReturnValue({ data: session, status: 'authenticated' });
  global.fetch = jest.fn(async input => {
    if (input === '/api/auth/session') return unavailable ? new Promise<Response>(() => {}) : { ok: true, json: async () => session } as Response;
    return { ok: true, json: () => new Promise(resolve => { finishBody = resolve; }) } as Response;
  });
  const view = render(<SessionRecoveryProvider><MutationProbe /></SessionRecoveryProvider>);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save form' })).not.toBeDisabled());
  fireEvent.click(screen.getByRole('button', { name: 'Save form' }));
  await waitFor(() => expect(finishBody).toBeDefined());
  unavailable = true;
  (useSession as jest.Mock).mockReturnValue({ data: null, status: 'unauthenticated' });
  view.rerender(<SessionRecoveryProvider><MutationProbe /></SessionRecoveryProvider>);
  await act(async () => { finishBody({ saved: true }); });
  expect(screen.getByText('verification required')).toBeInTheDocument();
  expect(screen.queryByText('success')).not.toBeInTheDocument();
});
let performRead: (() => Promise<unknown>) | undefined;
function ReadProbe() {
  const fetch = useProtectedFetch();
  performRead = async () => (await fetch('/api/synthetic-student')).json();
  return null;
}

it('rejects a previous resource response even when the authenticated account is unchanged', async () => {
  (useSession as jest.Mock).mockReturnValue({ data: session, status: 'authenticated' });
  let finishRead!: (value: Response) => void;
  global.fetch = jest.fn(async input => input === '/api/auth/session'
    ? { ok: true, json: async () => session } as Response
    : new Promise<Response>(resolve => { finishRead = resolve; }));
  mockPathname = '/dashboard/coach/eleve/student-a';
  const view = render(<SessionRecoveryProvider><ReadProbe /></SessionRecoveryProvider>);
  await waitFor(() => expect(document.querySelector('[data-session-observation]')).toHaveAttribute('data-session-observation', 'AUTHENTICATED'));
  const reading = performRead!();
  const outcome = reading.then(() => false, () => true);
  mockPathname = '/dashboard/coach/eleve/student-b';
  view.rerender(<SessionRecoveryProvider><ReadProbe /></SessionRecoveryProvider>);
  await act(async () => { finishRead({ ok: true, json: async () => ({ student: 'private-a' }) } as Response); });
  expect(await outcome).toBe(true);
});
jest.unmock('@/components/auth/SessionRecoveryProvider');

function InitialReadProbe() {
  const fetch = useProtectedFetch();
  const [result, setResult] = useState('loading');
  useEffect(() => {
    let active = true;
    void fetch('/api/synthetic-student').then(response => response.json()).then(
      value => { if (active) setResult(value.student); },
      () => { if (active) setResult('read rejected'); },
    );
    return () => { active = false; };
  }, [fetch]);
  return <output>{result}</output>;
}

it('allows the new route initial read while its same-account verification starts', async () => {
  (useSession as jest.Mock).mockReturnValue({ data: session, status: 'authenticated' });
  let finishRead!: (value: Response) => void;
  global.fetch = jest.fn(async input => input === '/api/auth/session'
    ? { ok: true, json: async () => session } as Response
    : new Promise<Response>(resolve => { finishRead = resolve; }));
  mockPathname = '/dashboard/coach/eleve/student-a';
  const view = render(<SessionRecoveryProvider><ReadProbe /></SessionRecoveryProvider>);
  await waitFor(() => expect(document.querySelector('[data-session-observation]')).toHaveAttribute('data-session-observation', 'AUTHENTICATED'));
  mockPathname = '/dashboard/coach/eleve/student-b';
  view.rerender(<SessionRecoveryProvider><InitialReadProbe /></SessionRecoveryProvider>);
  await waitFor(() => expect(finishRead).toBeDefined());
  await waitFor(() => expect(document.querySelector('[data-session-observation]')).toHaveAttribute('data-session-observation', 'AUTHENTICATED'));
  await act(async () => { finishRead({ ok: true, json: async () => ({ student: 'student-b data' }) } as Response); });
  expect(screen.getByText('student-b data')).toBeInTheDocument();
});
