'use client';

import type { Session } from 'next-auth';

export type SessionObservationState = 'LOADING' | 'AUTHENTICATED' | 'RECOVERING' | 'UNAVAILABLE'
  | 'UNAUTHENTICATED_CONFIRMED' | 'REVOKED_CONFIRMED';
export type SessionProjection = { data: Session | null; status: 'loading' | 'authenticated' | 'unauthenticated' };
export type SessionObservation = {
  state: SessionObservationState;
  canMutate: boolean;
  protectedScope: boolean;
  identityEpoch: number;
};

/** Compare authority/identity claims, never rotating expiry. No V1 database assumptions. */
export function sessionIdentity(session: Session | null): string {
  if (!session) return '';
  const { expires: _expires, ...claims } = session;
  return JSON.stringify(claims, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value);
}

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object' || !('user' in value) || !('expires' in value)
    || typeof value.expires !== 'string' || !value.user || typeof value.user !== 'object') return false;
  return 'id' in value.user && typeof value.user.id === 'string' && value.user.id.length > 0
    && 'role' in value.user && typeof value.user.role === 'string' && value.user.role.length > 0;
}

/**
 * Shared extraction of #235: authoritative confirmation, bounded transport,
 * generation cancellation and getSession broadcast into the existing provider.
 * The retained view is only a draft/display owner, NOT permission to mutate.
 */
export class SessionRecoveryController {
  private listeners = new Set<() => void>();
  private raw: SessionProjection = { data: null, status: 'loading' };
  private route: string | null = null;
  private generation = 0;
  private request: AbortController | null = null;
  private deadline: ReturnType<typeof setTimeout> | null = null;
  private confirmation: Session | null = null;
  private logoutIntent = false;
  private logoutDestination = '/auth/signin';
  private view: SessionProjection;
  private observation: SessionObservation;

  constructor(
    private readonly verify: (signal: AbortSignal) => Promise<Response>,
    private readonly synchronize: () => Promise<Session | null>,
    serverSession: Session | null = null,
    private readonly renderedScope?: () => { raw: SessionProjection; route: string; active: boolean },
    private readonly projectionMode: 'authjs' | 'canonical-server' = 'authjs',
  ) {
    this.view = { data: serverSession, status: serverSession ? 'authenticated' : 'loading' };
    this.observation = { state: serverSession ? 'AUTHENTICATED' : 'LOADING', canMutate: false, protectedScope: !!renderedScope?.().active, identityEpoch: 0 };
  }

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getView = () => this.view;
  getSnapshot = () => this.observation;
  getRedirectDestination = () => this.logoutDestination;

  private publish(state: SessionObservationState, data = this.view.data) {
    const changedIdentity = sessionIdentity(data) !== sessionIdentity(this.view.data);
    const status = data ? 'authenticated' : state.endsWith('_CONFIRMED') ? 'unauthenticated' : 'loading';
    // Preserve object identity during recovery AND same-identity provider refresh.
    // Effects depending on session/status must not reload and overwrite drafts.
    if (changedIdentity || status !== this.view.status) this.view = { data, status };
    this.observation = {
      state, canMutate: !!this.route && state === 'AUTHENTICATED', protectedScope: !!this.route,
      identityEpoch: this.observation.identityEpoch + Number(changedIdentity),
    };
    this.listeners.forEach(listener => listener());
  }

  private cancel() {
    this.generation++;
    this.request?.abort();
    this.request = null;
    this.confirmation = null;
    if (this.deadline) clearTimeout(this.deadline);
    this.deadline = null;
  }

  stop = () => { this.cancel(); this.route = null; this.publish('RECOVERING'); };

  observe(raw: SessionProjection, route: string) {
    const changedRoute = this.route !== route;
    this.raw = raw;
    this.route = route;
    if (this.logoutIntent) return;

    if (raw.data && this.view.data && sessionIdentity(raw.data) !== sessionIdentity(this.view.data)) {
      this.cancel();
      this.publish('RECOVERING', null);
      this.start();
      return;
    }
    if (changedRoute) { this.start(); return; }
    if (this.confirmation && raw.status === 'authenticated'
      && sessionIdentity(raw.data) === sessionIdentity(this.confirmation)) {
      this.accept(this.confirmation);
      return;
    }
    if (this.request || this.observation.state === 'UNAVAILABLE' || this.observation.state.endsWith('_CONFIRMED')) return;
    if (raw.status !== 'authenticated' || !raw.data) this.start();
  }

  private accept(session: Session) {
    this.cancel();
    this.publish('AUTHENTICATED', session);
  }

  private start() {
    this.cancel();
    if (!this.route || this.logoutIntent) return;
    const generation = this.generation;
    const controller = new AbortController();
    this.request = controller;
    const current = () => this.generation === generation && !controller.signal.aborted && !this.logoutIntent;
    this.publish(this.view.data ? 'RECOVERING' : 'LOADING');
    this.deadline = setTimeout(() => {
      if (!current()) return;
      // Ten seconds degrades the UI only. A slow authoritative response
      // must still recover or retire the session without another attempt.
      this.deadline = null;
      this.publish('UNAVAILABLE');
    }, 10_000);
    void (async () => {
      try {
        const response = await this.verify(controller.signal);
        if (!response.ok) throw new Error('SESSION_VERIFICATION_UNAVAILABLE');
        const confirmed: unknown = await response.json();
        if (!current()) return;
        if (confirmed === null) {
          const wasAuthenticated = !!this.view.data;
          this.cancel();
          this.publish(wasAuthenticated ? 'REVOKED_CONFIRMED' : 'UNAUTHENTICATED_CONFIRMED', null);
          return;
        }
        if (!isSession(confirmed)) throw new Error('SESSION_VERIFICATION_UNAVAILABLE');
        if (this.projectionMode === 'canonical-server') {
          this.accept(confirmed);
          return;
        }
        this.confirmation = confirmed;
        if (this.raw.status === 'authenticated' && sessionIdentity(this.raw.data) === sessionIdentity(confirmed)) {
          this.accept(confirmed);
          return;
        }
        // This is NOT update(): #235 proved update-only poisons Auth.js's
        // internal null cache and prevents later focus revocation refresh.
        const recovered = await this.synchronize();
        if (!current()) return;
        if (!isSession(recovered) || sessionIdentity(recovered) !== sessionIdentity(confirmed)) {
          throw new Error('SESSION_RECOVERY_UNAVAILABLE');
        }
        // Provider concordance is observed separately, not inferred from this
        // fetch result; the remaining deadline also bounds a stuck broadcast.
        if (this.raw.status === 'authenticated' && sessionIdentity(this.raw.data) === sessionIdentity(confirmed)) this.accept(confirmed);
      } catch {
        if (!current()) return;
        // An early transport failure is still recovery, not logout. Keep the
        // original UX deadline; explicit retry can start a fresh attempt.
        this.confirmation = null;
      }
    })();
  }

  retry = () => {
    // Retrying observes the server; it never replays a pending logout write.
    // The new generation supersedes that operation's eventual client result.
    this.logoutIntent = false;
    this.start();
  };
  beginLogout = (destination = '/auth/signin') => {
    this.logoutDestination = destination;
    this.logoutIntent = true; this.cancel(); this.publish('RECOVERING');
    return this.generation;
  };
  confirmLogout = (operation: number) => {
    if (!this.logoutIntent || operation !== this.generation) return;
    this.cancel(); this.publish('UNAUTHENTICATED_CONFIRMED', null);
  };
  runLogout = async <T>(perform: () => Promise<T>, destination: string): Promise<T> => {
    const operation = this.beginLogout(destination);
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const current = () => {
      if (!this.logoutIntent || operation !== this.generation || abort.signal.aborted) throw new Error('SESSION_OPERATION_SUPERSEDED');
    };
    try {
      timer = setTimeout(() => {
        if (this.logoutIntent && operation === this.generation) this.publish('UNAVAILABLE');
      }, 10_000);
      const result = await perform();
      current();
      const response = await this.verify(abort.signal);
      if (!response.ok || await response.json() !== null) throw new Error('LOGOUT_NOT_CONFIRMED');
      current();
      this.confirmLogout(operation);
      return result;
    } catch (error) {
      this.failedLogout(operation);
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
      abort.abort();
    }
  };
  failedLogout = (operation: number) => {
    if (!this.logoutIntent || operation !== this.generation) return;
    this.cancel();
    this.logoutIntent = false; this.publish('UNAVAILABLE');
  };
  enteredPublicRoute = () => {
    this.stop();
    this.logoutIntent = false;
    this.logoutDestination = '/auth/signin';
    this.publish('LOADING', null);
  };

  /** Capture before an async chain; check again before its next side effect. */
  captureObservation = () => {
    const epoch = this.observation.identityEpoch;
    const route = this.renderedScope?.().route ?? this.route;
    // Initial reads can start alongside first verification; an already-verified
    // read is retired by any subsequent recovery, logout or navigation.
    const generation = this.observation.canMutate && route === this.route ? this.generation : null;
    return () => {
      const rendered = this.renderedScope?.();
      if (this.observation.identityEpoch !== epoch || (rendered?.route ?? this.route) !== route
        || (rendered && !rendered.active) || this.observation.state.endsWith('_CONFIRMED')
        || this.logoutIntent || (generation !== null && this.generation !== generation)) {
        throw new Error('SESSION_OBSERVATION_SUPERSEDED');
      }
    };
  };

  bindDeferredMutation = (task: () => void): (() => void) => {
    let check: () => void;
    try { check = this.captureMutation(); } catch { return () => {}; }
    return () => {
      try { check(); } catch { return; }
      task();
    };
  };

  captureMutation = () => {
    const epoch = this.observation.identityEpoch;
    const generation = this.generation;
    const check = () => {
      const rendered = this.renderedScope?.();
      if (rendered && (!rendered.active || rendered.route !== this.route || rendered.raw.status !== 'authenticated'
        || sessionIdentity(rendered.raw.data) !== sessionIdentity(this.view.data))) {
        throw new Error('SESSION_VERIFICATION_UNAVAILABLE');
      }
      if (!this.observation.canMutate || this.observation.identityEpoch !== epoch || this.generation !== generation) {
        throw new Error('SESSION_VERIFICATION_UNAVAILABLE');
      }
    };
    check();
    return check;
  };
}
