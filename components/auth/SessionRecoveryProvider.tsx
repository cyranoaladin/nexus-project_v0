'use client';

import { Suspense, createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getSession, signOut, useSession } from 'next-auth/react';
import type { SignOutParams } from 'next-auth/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SessionRecoveryController, sessionIdentity } from '@/lib/auth/client-session-recovery';
import type { Session } from 'next-auth';

const RecoveryContext = createContext<SessionRecoveryController | null>(null);

/** UI coverage only. Every route/API keeps its independent server authorization. */
export function isProtectedSessionPath(path: string) {
  return /^\/(?:dashboard(?:\/|$)|admin\/directeur(?:\/|$)|session\/video(?:\/|$)|assessments\/[^/]+\/(?:processing|result)(?:\/|$)|bilan-gratuit\/assessment(?:\/|$)|programme\/maths-(?:1ere|terminale)(?:\/|$)|bilan-pallier2-maths\/dashboard(?:\/|$))/.test(path);
}

export function useSessionRecoveryController() {
  const controller = useContext(RecoveryContext);
  if (!controller) throw new Error('CANONICAL_SESSION_PROVIDER_REQUIRED');
  return controller;
}

/** Stable display/draft identity. status is render compatibility, NEVER authorization. */
export function useCanonicalSession() {
  const controller = useSessionRecoveryController();
  return useSyncExternalStore(controller.subscribe, controller.getView, controller.getView);
}

export function useSessionRecoveryState() {
  const controller = useSessionRecoveryController();
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
}

/** UI primitives outside protected scope remain usable. */
export function useSessionMutationSuspended() {
  const controller = useContext(RecoveryContext);
  const subscribe = controller?.subscribe ?? (() => () => {});
  const read = controller ? () => controller.getSnapshot().protectedScope && !controller.getSnapshot().canMutate : () => false;
  return useSyncExternalStore(subscribe, read, () => false);
}

export function SessionRecoveryNotice() {
  const controller = useSessionRecoveryController();
  const { state } = useSessionRecoveryState();
  const logout = useCanonicalSignOut();
  const [loggingOut, setLoggingOut] = useState(false);
  if (state !== 'RECOVERING' && state !== 'UNAVAILABLE') return null;
  return <div role="status" data-testid="session-recovery-notice" className="border border-amber-500/40 bg-slate-950 p-4 text-slate-100">
    <p>{state === 'UNAVAILABLE'
      ? 'La vérification de votre session est momentanément indisponible. Votre travail est conservé. Les actions sont suspendues.'
      : 'Vérification de votre session en cours. Votre travail est conservé.'}</p>
    <button type="button" data-session-recovery-control="true" onClick={controller.retry}
      className="mt-2 rounded border border-slate-300 px-3 py-2">Réessayer la vérification</button>
    <button type="button" data-session-recovery-control="true" disabled={loggingOut}
      className="ml-2 mt-2 rounded border border-slate-300 px-3 py-2" onClick={async () => {
        setLoggingOut(true);
        try { await logout({ callbackUrl: '/auth/signin' }); }
        catch { /* The controller exposes UNAVAILABLE; no fake successful logout. */ }
        finally { setLoggingOut(false); }
      }}>Se déconnecter</button>
  </div>;
}

/** Portals need controls within their focus trap. Public dialogs have no auth UI. */
export function SessionRecoveryControls() {
  const controller = useContext(RecoveryContext);
  return controller ? <SessionRecoveryNotice /> : null;
}

export function SessionMutationBoundary({ children }: { children: React.ReactNode }) {
  const suspended = useSessionMutationSuspended();
  return <fieldset disabled={suspended} className="m-0 min-w-0 border-0 p-0 [display:contents]" aria-busy={suspended}
    onSubmitCapture={event => { if (suspended) { event.preventDefault(); event.stopPropagation(); } }}
    onClickCapture={event => {
      if (suspended && event.target instanceof Element
        && !event.target.closest('[data-session-recovery-control]')) {
        event.preventDefault(); event.stopPropagation();
      }
    }}>{children}</fieldset>;
}

function ProtectedObservationBoundary({ children }: { children: React.ReactNode }) {
  const controller = useSessionRecoveryController();
  const pathname = usePathname();
  const { state, identityEpoch } = useSessionRecoveryState();
  const router = useRouter();
  const confirmed = state.endsWith('_CONFIRMED');
  useEffect(() => { if (confirmed) router.replace(controller.getRedirectDestination()); }, [confirmed, router, controller]);
  if (confirmed) return <div role="status">Session terminée. Redirection vers la connexion…</div>;
  return <div key={`${identityEpoch}:${pathname}`} data-session-observation={state}>
    <SessionRecoveryNotice />
    <SessionMutationBoundary>
      {children}
    </SessionMutationBoundary>
  </div>;
}

/** Query observation alone may suspend on static public pages; the application never does. */
function QueryObservation({ onChange, onRender }: { onChange: (search: string) => void; onRender: (search: string) => void }) {
  const search = useSearchParams()?.toString() ?? '';
  // Update only the scope ref during render, so descendant effects cannot
  // dispatch against the previous query while the observation effect catches up.
  onRender(search);
  useEffect(() => { onChange(search); }, [onChange, search]);
  return null;
}

/** One owner below the existing Auth.js provider; never installs another auth provider. */
export function SessionRecoveryProvider({ children }: { children: React.ReactNode }) {
  const raw = useSession();
  const pathname = usePathname() ?? '';
  const [search, setSearch] = useState('');
  const active = isProtectedSessionPath(pathname);
  const route = `${pathname}${search ? `?${search}` : ''}`;
  const latest = useRef({ raw, route, active });
  latest.current = { raw, route, active };
  const observeRenderedSearch = useCallback((currentSearch: string) => {
    latest.current.route = `${pathname}${currentSearch ? `?${currentSearch}` : ''}`;
  }, [pathname]);
  const [controller] = useState(() => new SessionRecoveryController(
    signal => fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store', signal }),
    () => getSession(),
    null,
    () => latest.current,
  ));
  useEffect(() => {
    if (active) controller.observe(raw, route);
  }, [controller, raw, active, route]);
  useEffect(() => {
    if (!active) controller.enteredPublicRoute();
  }, [controller, active, route]);
  useEffect(() => {
    const cancel = () => controller.stop();
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted && latest.current.active) controller.observe(latest.current.raw, latest.current.route);
    };
    const online = () => { if (latest.current.active && controller.getSnapshot().state === 'UNAVAILABLE') controller.retry(); };
    window.addEventListener('pagehide', cancel);
    window.addEventListener('pageshow', restore);
    window.addEventListener('online', online);
    return () => {
      controller.stop();
      window.removeEventListener('pagehide', cancel);
      window.removeEventListener('pageshow', restore);
      window.removeEventListener('online', online);
    };
  }, [controller]);
  return <RecoveryContext.Provider value={controller}>
    <Suspense fallback={null}><QueryObservation onChange={setSearch} onRender={observeRenderedSearch} /></Suspense>
    {active ? <ProtectedObservationBoundary>{children}</ProtectedObservationBoundary> : children}
  </RecoveryContext.Provider>;
}

/** A client identity cannot reveal a shell rendered for another server identity. */
export function ServerSessionShell({ serverSession, children }: { serverSession: Session; children: React.ReactNode }) {
  const { data } = useCanonicalSession();
  const router = useRouter();
  const mismatch = !!data && sessionIdentity(data) !== sessionIdentity(serverSession);
  useEffect(() => { if (mismatch) router.refresh(); }, [mismatch, router, data]);
  return !data || mismatch ? <div role="status">Actualisation de votre espace…</div> : children;
}

export function useCanonicalSignOut() {
  const controller = useSessionRecoveryController();
  const router = useRouter();
  return useCallback(async (options?: SignOutParams<boolean>) => {
    const destination = options?.redirectTo ?? options?.callbackUrl ?? '/auth/signin';
    try {
      // Installed Auth.js resolves some HTTP failures and may navigate anyway.
      // It still owns CSRF/cookies/provider broadcast; navigation waits for
      // positive confirmation from the existing canonical server-session path.
      const result = await controller.runLogout(() => signOut({ ...options, redirect: false }), destination);
      if (options?.redirect !== false) router.replace(destination);
      return result;
    } catch (error) {
      // Fire-and-forget navigation buttons surface failure through the shared
      // UNAVAILABLE notice. Explicit non-navigation callers still receive it.
      if (options?.redirect === false) throw error;
      return undefined;
    }
  }, [controller, router]);
}

/** Same server-side authorization still applies; this only prevents uncertain UI writes. */
export function useProtectedFetch() {
  const controller = useSessionRecoveryController();
  const identity = sessionIdentity(useCanonicalSession().data);
  const protectedAtRender = isProtectedSessionPath(usePathname() ?? '');
  return useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
    // A reusable public component keeps its existing API contract. A callback
    // captured on a protected page never acquires this exemption on navigation.
    if (!protectedAtRender) return fetch(input, init);
    if (!identity || sessionIdentity(controller.getView().data) !== identity) throw new Error('SESSION_IDENTITY_CHANGED');
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const check = ['GET', 'HEAD', 'OPTIONS'].includes(method) ? controller.captureObservation() : controller.captureMutation();
    const epoch = controller.getSnapshot().identityEpoch;
    const stillCurrent = () => {
      if (controller.getSnapshot().identityEpoch !== epoch) throw new Error('SESSION_IDENTITY_CHANGED');
      check?.();
    };
    const response = await fetch(input, init);
    stillCurrent();
    if (response.status === 401) {
      controller.retry();
      throw new Error('La session doit être vérifiée. Votre travail est conservé.');
    }
    const guardedResponse = (target: Response): Response => new Proxy(target, {
      get(object, property) {
        stillCurrent();
        const value = Reflect.get(object, property, object);
        if (property === 'clone') return () => guardedResponse(object.clone());
        if (['json', 'text', 'blob', 'arrayBuffer', 'formData', 'bytes'].includes(String(property))) {
          return async (...args: unknown[]) => {
            stillCurrent();
            const body = await value.apply(object, args);
            stillCurrent();
            return body;
          };
        }
        return typeof value === 'function' ? value.bind(object) : value;
      },
    });
    return guardedResponse(response);
  }, [controller, identity, protectedAtRender]);
}
