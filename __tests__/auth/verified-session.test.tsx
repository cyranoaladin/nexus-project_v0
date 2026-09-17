import { act, renderHook as renderHookBase, waitFor } from '@testing-library/react';
import { getSession, useSession } from 'next-auth/react';
import { useVerifiedSession } from '@/hooks/use-verified-session';

import { SessionRecoveryProvider, useSessionRecoveryController, useSessionRecoveryState } from '@/components/auth/SessionRecoveryProvider';

function subject(role: string) {
  const view = useVerifiedSession(role);
  const recovery = useSessionRecoveryState();
  const controller = useSessionRecoveryController();
  return { ...view, verificationUnavailable: recovery.state === 'UNAVAILABLE', retryVerification: controller.retry };
}
function renderHook<T>(callback: () => T) {
  return renderHookBase(callback, { wrapper: ({ children }) => <SessionRecoveryProvider>{children}</SessionRecoveryProvider> });
}
const search = new URLSearchParams();
const replace = jest.fn();
const update = jest.fn();
const router = { replace };
jest.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/dashboard/parent', useSearchParams: () => search }));
jest.mock('next-auth/react', () => ({ useSession: jest.fn(), getSession: jest.fn() }));
const originalFetch = global.fetch;
const authenticated = { user: { id: 'synthetic-parent', role: 'PARENT' }, expires: '2099-01-01T00:00:00Z' };
const response = (body: unknown, ok = true) => ({ ok, json: async () => body });
beforeEach(() => {
  jest.clearAllMocks();
  (useSession as jest.Mock).mockReturnValue({ data: null, status: 'unauthenticated', update });
  update.mockResolvedValue(authenticated);
  (getSession as jest.Mock).mockResolvedValue(authenticated);
});
afterEach(() => { jest.useRealTimers(); });
afterAll(() => { global.fetch = originalFetch; });

it.each([
  ['network failure', () => Promise.reject(new TypeError('Failed to fetch'))],
  ['abort', () => Promise.reject(new DOMException('Aborted', 'AbortError'))],
  ['HTTP failure', () => Promise.resolve(response(null, false))],
  ['invalid session shape', () => Promise.resolve(response({ unexpected: true }))],
  ['invalid JSON', () => Promise.resolve({ ok: true, json: async () => { throw new SyntaxError(); } })],
])('does not redirect or restore identity on %s', async (_name, implementation) => {
  jest.useFakeTimers();
  global.fetch = jest.fn().mockImplementation(implementation);
  const { result } = renderHook(() => subject('PARENT'));
  await act(async () => { jest.advanceTimersByTime(10_000); });
  await waitFor(() => expect(result.current.verificationUnavailable).toBe(true));
  expect(replace).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
  expect(getSession).not.toHaveBeenCalled();
  expect(result.current.data).toBeNull();
});

it('redirects a server-confirmed revoked session', async () => {
  global.fetch = jest.fn().mockResolvedValue(response(null));
  renderHook(() => subject('PARENT'));
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/auth/signin'));
  expect(global.fetch).toHaveBeenCalledWith('/api/auth/session', expect.objectContaining({
    credentials: 'same-origin', cache: 'no-store', signal: expect.any(AbortSignal),
  }));
});

it('recovers through the existing provider without navigating or keeping a second identity', async () => {
  global.fetch = jest.fn().mockResolvedValue(response(authenticated));
  const { result } = renderHook(() => subject('PARENT'));
  await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1));
  expect(update).not.toHaveBeenCalled();
  expect(replace).not.toHaveBeenCalled();
  expect(result.current.data).toBeNull(); // Only useSession may supply identity.
});

it('ignores a response arriving after unmount', async () => {
  let complete!: (value: unknown) => void;
  global.fetch = jest.fn().mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  const { unmount } = renderHook(() => subject('PARENT'));
  const signal = (global.fetch as jest.Mock).mock.calls[0][1].signal;
  unmount();
  await act(async () => complete(response(null)));
  expect(signal.aborted).toBe(true);
  expect(replace).not.toHaveBeenCalled();
});

it('ignores a response after pagehide starts a document navigation', async () => {
  let complete!: (value: unknown) => void;
  global.fetch = jest.fn().mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  renderHook(() => subject('PARENT'));
  await act(async () => {
    window.dispatchEvent(new Event('pagehide'));
    complete(response(null));
  });
  expect(replace).not.toHaveBeenCalled();
});

it('can explicitly retry verification after a transport failure', async () => {
  jest.useFakeTimers();
  global.fetch = jest.fn().mockRejectedValueOnce(new TypeError()).mockResolvedValue(response(null));
  const { result } = renderHook(() => subject('PARENT'));
  await act(async () => { jest.advanceTimersByTime(10_000); });
  await waitFor(() => expect(result.current.verificationUnavailable).toBe(true));
  act(() => result.current.retryVerification());
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/auth/signin'));
});

it('restarts verification when WebKit restores an interrupted document from back-forward cache', async () => {
  global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));
  renderHook(() => subject('PARENT'));
  await act(async () => {
    window.dispatchEvent(new Event('pagehide'));
    const restored = new Event('pageshow');
    Object.defineProperty(restored, 'persisted', { value: true });
    window.dispatchEvent(restored);
  });
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect((global.fetch as jest.Mock).mock.calls[0][1].signal.aborted).toBe(true);
  expect((global.fetch as jest.Mock).mock.calls[1][1].signal.aborted).toBe(false);
});

it('exposes retry if verification hangs without redirecting', async () => {
  jest.useFakeTimers();
  try {
    global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => subject('PARENT'));
    await act(async () => { jest.advanceTimersByTime(10_000); });
    expect(result.current.verificationUnavailable).toBe(true);
    expect(replace).not.toHaveBeenCalled();
    // The ten-second threshold changes UX only; a late server answer remains valid.
    expect((global.fetch as jest.Mock).mock.calls[0][1].signal.aborted).toBe(false);
  } finally { jest.useRealTimers(); }
});

it('exposes retry if the existing provider does not converge after recovery', async () => {
  jest.useFakeTimers();
  try {
    global.fetch = jest.fn().mockResolvedValue(response(authenticated));
    const { result } = renderHook(() => subject('PARENT'));
    await act(async () => {});
    await act(async () => { jest.advanceTimersByTime(10_000); });
    expect(result.current.verificationUnavailable).toBe(true);
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  } finally { jest.useRealTimers(); }
});

it('confirms the server authority on entering a protected route even with a populated provider', async () => {
  global.fetch = jest.fn().mockResolvedValue(response(authenticated));
  (useSession as jest.Mock).mockReturnValue({ data: authenticated, status: 'authenticated', update });
  renderHook(() => subject('PARENT'));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  expect(replace).not.toHaveBeenCalled();
});

it('denies an authenticated wrong role', async () => {
  global.fetch = jest.fn().mockResolvedValue(response(authenticated));
  (useSession as jest.Mock).mockReturnValue({ data: authenticated, status: 'authenticated', update });
  renderHook(() => subject('ADMIN'));
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/auth/signin'));
});
jest.unmock('@/components/auth/SessionRecoveryProvider');
