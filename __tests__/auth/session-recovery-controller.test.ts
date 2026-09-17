import type { Session } from 'next-auth';
import { SessionRecoveryController } from '@/lib/auth/client-session-recovery';

const session = { user: { id: 'synthetic-a', role: 'ADMIN' }, expires: '2099-01-01T00:00:00Z' } as Session;
const response = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

describe('one canonical recovery controller', () => {
  let controller: SessionRecoveryController;
  afterEach(() => { controller?.stop(); jest.useRealTimers(); });

  it('preserves the same display object while unavailable and only resumes after provider concordance', async () => {
    jest.useFakeTimers();
    let available = false;
    const verify = jest.fn(() => available ? Promise.resolve(response(session)) : new Promise<Response>(() => {}));
    const synchronize = jest.fn(async () => session);
    controller = new SessionRecoveryController(verify, synchronize, session);
    const before = controller.getView();
    controller.observe({ data: null, status: 'unauthenticated' }, '/dashboard/admin');
    expect(controller.getSnapshot().state).toBe('RECOVERING');
    expect(controller.getSnapshot().canMutate).toBe(false);
    jest.advanceTimersByTime(10_000);
    expect(controller.getSnapshot().state).toBe('UNAVAILABLE');
    expect(controller.getView()).toBe(before);
    available = true;
    controller.retry();
    await flush();
    expect(synchronize).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().canMutate).toBe(false);
    controller.observe({ data: session, status: 'authenticated' }, '/dashboard/admin');
    expect(controller.getSnapshot().state).toBe('AUTHENTICATED');
    expect(controller.getSnapshot().canMutate).toBe(true);
    expect(controller.getView()).toBe(before);
  });

  it.each(['network', 'http', 'shape'])('never confirms logout from %s failure', async kind => {
    jest.useFakeTimers();
    const verify = jest.fn(async () => {
      if (kind === 'network') throw new TypeError('offline');
      return response(kind === 'shape' ? { unexpected: true } : null, kind !== 'http');
    });
    controller = new SessionRecoveryController(verify, jest.fn(), session);
    controller.observe({ data: null, status: 'unauthenticated' }, '/dashboard/admin');
    await flush();
    expect(controller.getSnapshot().state).toBe('RECOVERING');
    jest.advanceTimersByTime(9_999);
    expect(controller.getSnapshot().state).toBe('RECOVERING');
    jest.advanceTimersByTime(1);
    expect(controller.getSnapshot().state).toBe('UNAVAILABLE');
    expect(controller.getView().data).toBe(session);
  });

  it.each(['valid', 'revoked'])('accepts a slow %s canonical result after the UX threshold without a retry', async outcome => {
    jest.useFakeTimers();
    let finish!: (value: Response) => void;
    let signal!: AbortSignal;
    const verify = jest.fn((requestSignal: AbortSignal) => {
      signal = requestSignal;
      return new Promise<Response>(resolve => { finish = resolve; });
    });
    const synchronize = jest.fn(async () => session);
    controller = new SessionRecoveryController(verify, synchronize, session);
    const before = controller.getView();
    controller.observe({ data: null, status: 'unauthenticated' }, '/dashboard/admin');
    jest.advanceTimersByTime(11_000);
    expect(controller.getSnapshot().state).toBe('UNAVAILABLE');
    expect(controller.getSnapshot().canMutate).toBe(false);
    expect(controller.getView()).toBe(before);
    expect(signal.aborted).toBe(false);

    finish(response(outcome === 'valid' ? session : null));
    await flush();
    if (outcome === 'valid') {
      expect(synchronize).toHaveBeenCalledTimes(1);
      controller.observe({ data: session, status: 'authenticated' }, '/dashboard/admin');
      expect(controller.getSnapshot().state).toBe('AUTHENTICATED');
      expect(controller.getView()).toBe(before);
    } else {
      expect(controller.getSnapshot().state).toBe('REVOKED_CONFIRMED');
      expect(controller.getView().data).toBeNull();
    }
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it('retires protected state on positive server null', async () => {
    controller = new SessionRecoveryController(async () => response(null), jest.fn(), session);
    controller.observe({ data: null, status: 'unauthenticated' }, '/dashboard/admin');
    await flush();
    expect(controller.getSnapshot().state).toBe('REVOKED_CONFIRMED');
    expect(controller.getView().data).toBeNull();
    expect(controller.getSnapshot().canMutate).toBe(false);
  });

  it('ignores confirmation from a departed route and restarts on restoration', async () => {
    let finish!: (response: Response) => void;
    const verify = jest.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
    controller = new SessionRecoveryController(verify, jest.fn(), session);
    controller.observe({ data: null, status: 'unauthenticated' }, '/dashboard/admin');
    const old = finish;
    controller.stop();
    old(response(null));
    await flush();
    expect(controller.getView().data).toBe(session);
    controller.observe({ data: null, status: 'unauthenticated' }, '/dashboard/admin');
    expect(verify).toHaveBeenCalledTimes(2);
  });

  it('invalidates late recovery before intentional logout', async () => {
    let finish!: (response: Response) => void;
    const synchronize = jest.fn();
    controller = new SessionRecoveryController(() => new Promise(resolve => { finish = resolve; }), synchronize, session);
    controller.observe({ data: null, status: 'unauthenticated' }, '/dashboard/admin');
    const operation = controller.beginLogout();
    finish(response(session));
    await flush();
    expect(synchronize).not.toHaveBeenCalled();
    expect(controller.getSnapshot().canMutate).toBe(false);
    controller.confirmLogout(operation);
    controller.observe({ data: session, status: 'authenticated' }, '/dashboard/admin');
    expect(controller.getView().data).toBeNull();
  });

  it.each(['signout', 'verification'])('finishes genuine logout after slow %s crosses the UX threshold', async slow => {
    jest.useFakeTimers();
    let release!: () => void;
    const delay = new Promise<void>(resolve => { release = resolve; });
    const perform = jest.fn(async () => { if (slow === 'signout') await delay; return 'signed-out'; });
    const verify = jest.fn(async () => { if (slow === 'verification') await delay; return response(null); });
    controller = new SessionRecoveryController(verify, jest.fn(), session);
    const result = controller.runLogout(perform, '/auth/signin');
    const settled = jest.fn();
    void result.then(settled, settled);
    await flush();
    jest.advanceTimersByTime(11_000);
    await flush();
    expect(controller.getSnapshot().state).toBe('UNAVAILABLE');
    expect(controller.getView().data).toBe(session);
    expect(settled).not.toHaveBeenCalled();
    release();
    await expect(result).resolves.toBe('signed-out');
    expect(controller.getSnapshot().state).toBe('UNAUTHENTICATED_CONFIRMED');
    expect(controller.getView().data).toBeNull();
    expect(perform).toHaveBeenCalledTimes(1);
  });

  it('can retry verification during slow logout without replaying the signout mutation', async () => {
    jest.useFakeTimers();
    let finish!: () => void;
    const perform = jest.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const verify = jest.fn(async () => response(null));
    controller = new SessionRecoveryController(verify, jest.fn(), session);
    controller.observe({ data: session, status: 'authenticated' }, '/dashboard/admin');
    const operation = controller.runLogout(perform, '/auth/signin');
    void operation.catch(() => {});
    jest.advanceTimersByTime(11_000);
    controller.retry();
    await flush();
    expect(controller.getSnapshot().state).toBe('REVOKED_CONFIRMED');
    expect(perform).toHaveBeenCalledTimes(1);
    finish();
    await expect(operation).rejects.toThrow('SESSION_OPERATION_SUPERSEDED');
  });

  it('does not reuse an old owner when another same-role identity appears', async () => {
    const other = { ...session, user: { ...session.user, id: 'synthetic-b' } };
    controller = new SessionRecoveryController(async () => response(other), jest.fn(), session);
    controller.observe({ data: other, status: 'authenticated' }, '/dashboard/admin');
    expect(controller.getView().data).toBeNull();
    await flush();
    expect(controller.getView().data?.user.id).toBe('synthetic-b');
    expect(controller.getSnapshot().identityEpoch).toBeGreaterThan(0);
  });

  it('does not revive a pre-recovery mutation chain after the same identity recovers', async () => {
    controller = new SessionRecoveryController(async () => response(session), jest.fn(), session);
    controller.observe({ data: session, status: 'authenticated' }, '/dashboard/admin');
    await flush();
    const oldMutation = controller.captureMutation();
    controller.retry();
    await flush();
    expect(controller.getSnapshot().canMutate).toBe(true);
    expect(oldMutation).toThrow('SESSION_VERIFICATION_UNAVAILABLE');
    expect(controller.captureMutation()).not.toThrow();
  });

  it('explicitly leaves protected scope on public navigation without declaring authentication', async () => {
    controller = new SessionRecoveryController(async () => response(session), jest.fn(), session);
    controller.observe({ data: session, status: 'authenticated' }, '/dashboard/admin');
    await flush();
    expect(controller.getSnapshot()).toMatchObject({ protectedScope: true });
    controller.enteredPublicRoute();
    expect(controller.getSnapshot()).toMatchObject({ protectedScope: false, canMutate: false });
  });

  it('prevents new mutations once the observation owner stops', async () => {
    controller = new SessionRecoveryController(async () => response(session), jest.fn(), session);
    controller.observe({ data: session, status: 'authenticated' }, '/dashboard/admin');
    await flush();
    controller.stop();
    expect(() => controller.captureMutation()).toThrow('SESSION_VERIFICATION_UNAVAILABLE');
  });

  it('ignores the completion of a logout belonging to a departed identity', async () => {
    const other = { ...session, user: { ...session.user, id: 'synthetic-b' } };
    controller = new SessionRecoveryController(async () => response(other), jest.fn(), session);
    const oldLogout = controller.beginLogout();
    controller.enteredPublicRoute();
    controller.observe({ data: other, status: 'authenticated' }, '/dashboard/admin');
    await flush();
    controller.confirmLogout(oldLogout);
    expect(controller.getView().data?.user.id).toBe('synthetic-b');
    expect(controller.getSnapshot().canMutate).toBe(true);
  });

  it('blocks mutations for a newly rendered scope before the observation effect runs', async () => {
    const rendered = { raw: { data: session, status: 'authenticated' as const }, route: '/dashboard/admin', active: true };
    controller = new SessionRecoveryController(async () => response(session), jest.fn(), session, () => rendered);
    controller.observe(rendered.raw, rendered.route);
    await flush();
    expect(controller.captureMutation()).not.toThrow();
    rendered.route = '/dashboard/admin/users';
    expect(() => controller.captureMutation()).toThrow('SESSION_VERIFICATION_UNAVAILABLE');
  });

  it('drops deferred writes across uncertainty instead of replaying them after recovery', async () => {
    controller = new SessionRecoveryController(async () => response(session), jest.fn(), session);
    controller.observe({ data: session, status: 'authenticated' }, '/dashboard/admin');
    await flush();
    const write = jest.fn();
    const deferred = controller.bindDeferredMutation(write);
    controller.retry();
    await flush();
    deferred();
    expect(write).not.toHaveBeenCalled();
    controller.bindDeferredMutation(write)();
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('supports a static document without inventing an Auth.js projection or a second verifier', async () => {
    const synchronize = jest.fn();
    controller = new SessionRecoveryController(async () => response(session), synchronize, null, undefined, 'canonical-server');
    controller.observe({ data: null, status: 'loading' }, '/planning');
    await flush();
    expect(controller.getSnapshot().state).toBe('AUTHENTICATED');
    expect(controller.getView().data).toBe(session);
    expect(synchronize).not.toHaveBeenCalled();
  });
});
