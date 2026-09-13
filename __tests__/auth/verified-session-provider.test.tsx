import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import { useVerifiedSession } from '@/hooks/use-verified-session';
import { SessionRecoveryProvider, useCanonicalSignOut } from '@/components/auth/SessionRecoveryProvider';

jest.unmock('next-auth/react');
const replace = jest.fn();
const router = { replace };
const search = new URLSearchParams();
let mockPathname = '/dashboard/admin';
jest.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => mockPathname, useSearchParams: () => search }));
beforeEach(() => { replace.mockClear(); mockPathname = '/dashboard/admin'; });

// Browser channel semantics: messages reach other instances, never their
// sender. The actual installed SessionProvider and refresh code are unmocked.
class BrowserChannel extends EventTarget {
  static channels = new Set<BrowserChannel>();
  constructor(readonly name: string) { super(); BrowserChannel.channels.add(this); }
  postMessage(data: unknown) {
    for (const channel of BrowserChannel.channels) {
      if (channel !== this && channel.name === this.name) {
        queueMicrotask(() => channel.dispatchEvent(new MessageEvent('message', { data })));
      }
    }
  }
  close() { BrowserChannel.channels.delete(this); }
}
function Probe() {
  const session = useVerifiedSession('ADMIN');
  return <div>{session.status === 'authenticated' ? 'protected-admin' : 'no-session'}</div>;
}

function DraftProbe() {
  const session = useVerifiedSession('ADMIN');
  const [draft, setDraft] = useState('');
  return session.status === 'authenticated'
    ? <input aria-label="Unsaved work" value={draft} onChange={event => setDraft(event.target.value)} />
    : <div>draft-not-mounted</div>;
}

it('keeps the mounted draft when a real provider refresh fails while the server confirmation is pending', async () => {
  const originalFetch = global.fetch;
  const originalChannel = global.BroadcastChannel;
  global.BroadcastChannel = BrowserChannel as unknown as typeof BroadcastChannel;
  const session = { user: { id: 'synthetic-admin', role: 'ADMIN' }, expires: '2099-01-01T00:00:00Z' };
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => session })
    .mockRejectedValueOnce(new TypeError('Synthetic transport failure'))
    .mockImplementation(() => new Promise(() => {}));
  const view = render(<SessionProvider session={session as Session}><SessionRecoveryProvider><DraftProbe /></SessionRecoveryProvider></SessionProvider>);
  try {
    fireEvent.change(await screen.findByLabelText('Unsaved work'), { target: { value: 'draft must survive' } });
    await act(async () => {
      const otherTab = new BrowserChannel('next-auth');
      otherTab.postMessage({ event: 'session' });
      otherTab.close();
    });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
    expect(screen.getByLabelText('Unsaved work')).toHaveValue('draft must survive');
    expect(replace).not.toHaveBeenCalled();
  } finally {
    view.unmount();
    global.fetch = originalFetch;
    global.BroadcastChannel = originalChannel;
  }
});

it('restores the real provider cache, so a later visibility refresh rejects server revocation', async () => {
  const originalFetch = global.fetch;
  const originalChannel = global.BroadcastChannel;
  global.BroadcastChannel = BrowserChannel as unknown as typeof BroadcastChannel;
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  const session = { user: { id: 'synthetic-admin', role: 'ADMIN' }, expires: '2099-01-01T00:00:00Z' };
  let revoke = false;
  let completeConfirmation!: (value: unknown) => void;
  const response = (body: unknown) => ({ ok: true, json: async () => body });
  global.fetch = jest.fn()
    .mockResolvedValueOnce(response(session))
    .mockRejectedValueOnce(new TypeError('Synthetic transport failure'))
    .mockImplementationOnce(() => new Promise(resolve => { completeConfirmation = resolve; }))
    .mockImplementation(async () => response(revoke ? null : session));
  const view = render(<SessionProvider session={session as Session}><SessionRecoveryProvider><Probe /></SessionRecoveryProvider></SessionProvider>);
  try {
    await screen.findByText('protected-admin');
    await act(async () => {
      const otherTab = new BrowserChannel('next-auth');
      otherTab.postMessage({ event: 'session' });
      otherTab.close();
    });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
    expect(screen.getByText('protected-admin')).toBeInTheDocument();
    await act(async () => completeConfirmation(response(session)));
    await waitFor(() => expect(document.querySelector('[data-session-observation]')).toHaveAttribute('data-session-observation', 'AUTHENTICATED'));
    revoke = true;
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/auth/signin'));
    expect(screen.queryByText('protected-admin')).not.toBeInTheDocument();
  } finally {
    view.unmount();
    global.fetch = originalFetch;
    global.BroadcastChannel = originalChannel;
  }
});
function LogoutProbe({ redirect = false }: { redirect?: boolean }) {
  const logout = useCanonicalSignOut();
  const [result, setResult] = useState('idle');
  return <><button onClick={async () => {
    try { const result = await logout({ redirect }); setResult(result ? 'logout-success' : 'logout-failure-surfaced'); }
    catch { setResult('logout-unavailable'); }
  }}>Logout transport</button><output>{result}</output></>;
}

it.each([false, true])('does not confirm failed real signout (redirect=%s) or leak a button rejection', async redirect => {
  const originalFetch = global.fetch;
  const originalChannel = global.BroadcastChannel;
  global.BroadcastChannel = BrowserChannel as unknown as typeof BroadcastChannel;
  const session = { user: { id: 'synthetic-admin', role: 'ADMIN' }, expires: '2099-01-01T00:00:00Z' };
  global.fetch = jest.fn(async (input) => {
    const path = String(input);
    if (path.endsWith('/csrf')) return { ok: true, json: async () => ({ csrfToken: 'synthetic-csrf' }) } as Response;
    if (path.endsWith('/signout')) return { ok: false, status: 500, json: async () => ({ error: 'Synthetic failure' }) } as Response;
    return { ok: true, json: async () => session } as Response;
  });
  const view = render(<SessionProvider session={session as Session}><SessionRecoveryProvider><LogoutProbe redirect={redirect} /></SessionRecoveryProvider></SessionProvider>);
  try {
    await waitFor(() => expect(document.querySelector('[data-session-observation]')).toHaveAttribute('data-session-observation', 'AUTHENTICATED'));
    fireEvent.click(screen.getByRole('button', { name: 'Logout transport' }));
    await screen.findByText(redirect ? 'logout-failure-surfaced' : 'logout-unavailable');
    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByText('logout-success')).not.toBeInTheDocument();
    expect(document.querySelector('[data-session-observation]')).toHaveAttribute('data-session-observation', 'UNAVAILABLE');
  } finally {
    view.unmount(); global.fetch = originalFetch; global.BroadcastChannel = originalChannel;
  }
});
it('degrades a hung real signout transport and ignores its late result after explicit retry', async () => {
  const originalFetch = global.fetch;
  const originalChannel = global.BroadcastChannel;
  global.BroadcastChannel = BrowserChannel as unknown as typeof BroadcastChannel;
  const session = { user: { id: 'synthetic-admin', role: 'ADMIN' }, expires: '2099-01-01T00:00:00Z' };
  let finishSignout!: (value: Response) => void;
  global.fetch = jest.fn(async input => {
    const path = String(input);
    if (path.endsWith('/csrf')) return { ok: true, json: async () => ({ csrfToken: 'synthetic-csrf' }) } as Response;
    if (path.endsWith('/signout')) return new Promise<Response>(resolve => { finishSignout = resolve; });
    return { ok: true, json: async () => session } as Response;
  });
  const view = render(<SessionProvider session={session as Session}><SessionRecoveryProvider><LogoutProbe /></SessionRecoveryProvider></SessionProvider>);
  try {
    await waitFor(() => expect(document.querySelector('[data-session-observation]')).toHaveAttribute('data-session-observation', 'AUTHENTICATED'));
    jest.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Logout transport' }));
    await act(async () => {});
    expect(finishSignout).toBeDefined();
    await act(async () => { jest.advanceTimersByTime(10_000); });
    expect(document.querySelector('[data-session-observation]')).toHaveAttribute('data-session-observation', 'UNAVAILABLE');
    expect(screen.queryByText('logout-success')).not.toBeInTheDocument();
    expect(screen.queryByText('logout-unavailable')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer la vérification' }));
    await act(async () => {});
    expect(document.querySelector('[data-session-observation]')).toHaveAttribute('data-session-observation', 'AUTHENTICATED');
    await act(async () => { finishSignout({ ok: false, status: 500, json: async () => ({ error: 'late synthetic failure' }) } as Response); });
    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByText('logout-success')).not.toBeInTheDocument();
  } finally {
    view.unmount(); global.fetch = originalFetch; global.BroadcastChannel = originalChannel; jest.useRealTimers();
  }
});
jest.unmock('@/components/auth/SessionRecoveryProvider');

it('finishes genuine logout on the public reset page after the real provider cache clears', async () => {
  mockPathname = '/auth/reset-password';
  const originalFetch = global.fetch;
  const originalChannel = global.BroadcastChannel;
  global.BroadcastChannel = BrowserChannel as unknown as typeof BroadcastChannel;
  const session = { user: { id: 'synthetic-admin', role: 'ADMIN' }, expires: '2099-01-01T00:00:00Z' };
  let signedOut = false;
  let sessionReads = 0;
  let confirm!: (value: Response) => void;
  global.fetch = jest.fn(async input => {
    const path = String(input);
    if (path.endsWith('/csrf')) return { ok: true, json: async () => ({ csrfToken: 'synthetic-csrf' }) } as Response;
    if (path.endsWith('/signout')) { signedOut = true; return { ok: true, json: async () => ({ url: '/auth/signin' }) } as Response; }
    if (path.endsWith('/api/auth/session') && signedOut && ++sessionReads > 1) return new Promise<Response>(resolve => { confirm = resolve; });
    return { ok: true, json: async () => signedOut ? null : session } as Response;
  });
  const view = render(<SessionProvider session={session as Session}><SessionRecoveryProvider><LogoutProbe /></SessionRecoveryProvider></SessionProvider>);
  try {
    fireEvent.click(screen.getByRole('button', { name: 'Logout transport' }));
    await waitFor(() => expect(confirm).toBeDefined());
    await act(async () => { confirm({ ok: true, json: async () => null } as Response); });
    expect(await screen.findByText('logout-success')).toBeInTheDocument();
    expect(screen.queryByText('logout-unavailable')).not.toBeInTheDocument();
  } finally { view.unmount(); global.fetch = originalFetch; global.BroadcastChannel = originalChannel; }
});
