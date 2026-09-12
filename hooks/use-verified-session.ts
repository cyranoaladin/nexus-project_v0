'use client';

import { getSession, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

/** A failed Auth.js client refresh is not proof that the server revoked a session. */
export function useVerifiedSession(role: string, redirect = '/auth/signin') {
  const session = useSession();
  const router = useRouter();
  const [verificationUnavailable, setVerificationUnavailable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const recoveryAttempted = useRef(false);
  const retryVerification = useCallback(() => {
    recoveryAttempted.current = false;
    setAttempt(value => value + 1);
  }, []);

  useEffect(() => {
    if (session.status === 'loading') return;
    if (session.status === 'authenticated' && session.data?.user) {
      recoveryAttempted.current = false;
      setVerificationUnavailable(false);
      if (session.data.user.role !== role) router.replace(redirect);
      return;
    }

    const controller = new AbortController();
    const pathname = window.location.pathname;
    const cancel = () => controller.abort();
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) retryVerification();
    };
    const current = () => !controller.signal.aborted && window.location.pathname === pathname;
    const deadline = window.setTimeout(() => {
      if (current()) setVerificationUnavailable(true);
      controller.abort();
    }, 10_000);
    window.addEventListener('pagehide', cancel);
    window.addEventListener('pageshow', restore);
    setVerificationUnavailable(false);

    void (async () => {
      try {
        const response = await fetch('/api/auth/session', {
          credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        });
        if (!response.ok) throw new Error('SESSION_VERIFICATION_UNAVAILABLE');
        const confirmed: unknown = await response.json();
        if (!current()) return;
        // Auth.js returns JSON null for an absent/revoked session. Other shapes
        // must not turn infrastructure failures into authentication decisions.
        if (confirmed === null) {
          router.replace(redirect);
          return;
        }
        if (typeof confirmed !== 'object' || !('user' in confirmed)
          || !confirmed.user || typeof confirmed.user !== 'object'
          || !('id' in confirmed.user) || typeof confirmed.user.id !== 'string'
          || !('role' in confirmed.user) || typeof confirmed.user.role !== 'string'
          || !('expires' in confirmed) || typeof confirmed.expires !== 'string') {
          throw new Error('SESSION_VERIFICATION_UNAVAILABLE');
        }
        if (recoveryAttempted.current) throw new Error('SESSION_RECOVERY_UNAVAILABLE');
        recoveryAttempted.current = true;
        // getSession broadcasts to the existing provider, which refreshes both
        // its internal cache and React context. update() alone leaves the
        // locked Auth.js version's cache null and disables later focus refresh.
        // Never supply the confirmed response as an identity/update payload.
        const recovered = await getSession();
        if (current() && !recovered?.user) setVerificationUnavailable(true);
      } catch {
        if (current()) setVerificationUnavailable(true);
      }
    })();

    return () => {
      controller.abort();
      window.clearTimeout(deadline);
      window.removeEventListener('pagehide', cancel);
      window.removeEventListener('pageshow', restore);
    };
  }, [session.status, session.data, role, redirect, router, attempt, retryVerification]);

  return { ...session, verificationUnavailable, retryVerification };
}
