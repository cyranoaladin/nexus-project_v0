'use client';
import { useCallback, useEffect, useState } from 'react';
import { useCanonicalSession, useProtectedFetch } from '@/components/auth/SessionRecoveryProvider';

export type CoreBusinessRole = 'ADMIN' | 'ASSISTANTE' | 'COACH' | 'PARENT' | 'ELEVE';
type Metadata = { state: 'ACTIVE'; role: CoreBusinessRole } | { state: 'NOT_ENABLED' | 'NOT_MEMBER' | 'INACTIVE' };
type View = Metadata | { state: 'LOADING' | 'UNAVAILABLE' | 'UNAUTHENTICATED' };
const roles: readonly string[] = ['ADMIN', 'ASSISTANTE', 'COACH', 'PARENT', 'ELEVE'];
function parseMetadata(value: unknown): Metadata | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const keys = Object.keys(data).sort().join(',');
  if (data.state === 'ACTIVE' && keys === 'role,state' && typeof data.role === 'string' && roles.includes(data.role))
    return { state: 'ACTIVE', role: data.role as CoreBusinessRole };
  if (keys === 'state' && (data.state === 'NOT_ENABLED' || data.state === 'NOT_MEMBER' || data.state === 'INACTIVE'))
    return { state: data.state };
  return null;
}

/** UI selection only: resource APIs still independently authorize every call. */
export function useCoreMembership() {
  const session = useCanonicalSession();
  const fetch = useProtectedFetch();
  const id = session.status === 'authenticated' ? session.data?.user.id ?? null : null;
  const authority = session.data?.user.authority;
  const [current, setCurrent] = useState<{ id: string | null; view: View }>({ id: null, view: { state: 'LOADING' } });
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    if (!id || authority !== 'V1') return;
    let alive = true;
    let generation = 0;
    let controller: AbortController | null = null;
    setCurrent({ id, view: { state: 'LOADING' } });
    const load = async () => {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      const requestGeneration = ++generation;
      let view: View = { state: 'UNAVAILABLE' };
      try {
        const response = await fetch('/api/v2/self/membership', { cache: 'no-store', credentials: 'same-origin', signal });
        if (response.ok) {
          const envelope: unknown = await response.json();
          if (envelope && typeof envelope === 'object' && 'ok' in envelope && envelope.ok === true && 'data' in envelope)
            view = parseMetadata(envelope.data) ?? { state: 'UNAVAILABLE' };
        }
      } catch { /* Constant state; no private provider message reaches the UI. */ }
      if (alive && !signal.aborted && requestGeneration === generation) setCurrent({ id, view });
    };
    const refresh = () => { void load(); };
    refresh();
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    return () => { alive = false; controller?.abort(); window.clearInterval(interval); window.removeEventListener('focus', refresh); };
  }, [id, authority, fetch, revision]);
  const view: View = session.status === 'unauthenticated' ? { state: 'UNAUTHENTICATED' }
    : session.status !== 'authenticated' || !id ? { state: 'LOADING' }
      : authority !== 'V1' ? { state: 'UNAVAILABLE' }
        : current.id !== id ? { state: 'LOADING' } : current.view;
  return { ...view, retry };
}
