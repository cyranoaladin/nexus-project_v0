import { act, render, screen, waitFor } from '@testing-library/react';
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import { useVerifiedSession } from '@/hooks/use-verified-session';

jest.unmock('next-auth/react');
const replace = jest.fn();
const router = { replace };
jest.mock('next/navigation', () => ({ useRouter: () => router }));

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
    .mockRejectedValueOnce(new TypeError('Synthetic transport failure'))
    .mockImplementationOnce(() => new Promise(resolve => { completeConfirmation = resolve; }))
    .mockImplementation(async () => response(revoke ? null : session));
  const view = render(<SessionProvider session={session as Session}><Probe /></SessionProvider>);
  try {
    await screen.findByText('protected-admin');
    await act(async () => {
      const otherTab = new BrowserChannel('next-auth');
      otherTab.postMessage({ event: 'session' });
      otherTab.close();
    });
    await screen.findByText('no-session');
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    await act(async () => completeConfirmation(response(session)));
    await screen.findByText('protected-admin');
    revoke = true;
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/auth/signin'));
    expect(screen.queryByText('protected-admin')).not.toBeInTheDocument();
  } finally {
    view.unmount();
    global.fetch = originalFetch;
    global.BroadcastChannel = originalChannel;
    BrowserChannel.channels.clear();
  }
});
