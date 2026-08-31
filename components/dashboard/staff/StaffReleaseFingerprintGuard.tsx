'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { CLIENT_RELEASE_SHA, canonicalReleaseSha } from '@/lib/release-fingerprint';

type StaffRole = 'ADMIN' | 'ASSISTANTE';
type FingerprintStatus = 'checking' | 'match' | 'mismatch' | 'unknown';
export const STAFF_RELEASE_FINGERPRINT_TIMEOUT_MS = 8_000;

export async function checkFingerprint(
  clientReleaseSha: string | null,
  signal: AbortSignal,
): Promise<Exclude<FingerprintStatus, 'checking'>> {
  const canonicalClientSha = canonicalReleaseSha(clientReleaseSha);
  if (canonicalClientSha === null) return 'mismatch';

  try {
    const response = await fetch('/api/health', {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-store' },
      signal,
    });
    if (!response.ok && response.status !== 503) return 'unknown';
    const body = await response.json() as { releaseSha?: unknown };
    const canonicalServerSha = canonicalReleaseSha(body.releaseSha);
    return canonicalServerSha !== null && canonicalServerSha === canonicalClientSha
      ? 'match'
      : 'mismatch';
  } catch (error) {
    if (signal.aborted) throw error;
    return 'unknown';
  }
}

export function StaffReleaseFingerprintGuard({
  staffRole,
  clientReleaseSha = CLIENT_RELEASE_SHA,
  reloadPage = () => window.location.reload(),
}: {
  staffRole: StaffRole;
  clientReleaseSha?: string | null;
  reloadPage?: () => void;
}) {
  const [status, setStatus] = useState<FingerprintStatus>('checking');
  const generation = useRef(0);
  const inFlight = useRef<{ controller: AbortController; timeoutId: number } | null>(null);

  const runCheck = useCallback((manual = false) => {
    if (inFlight.current !== null) return;
    const controller = new AbortController();
    const currentGeneration = ++generation.current;
    const operation = { controller, timeoutId: 0 };
    inFlight.current = operation;
    if (manual) setStatus('checking');
    operation.timeoutId = window.setTimeout(() => {
      if (currentGeneration !== generation.current || inFlight.current !== operation) return;
      controller.abort();
      inFlight.current = null;
      setStatus('unknown');
    }, STAFF_RELEASE_FINGERPRINT_TIMEOUT_MS);

    void checkFingerprint(clientReleaseSha, controller.signal).then((result) => {
      if (!controller.signal.aborted && currentGeneration === generation.current) setStatus(result);
    }).catch(() => undefined).finally(() => {
      window.clearTimeout(operation.timeoutId);
      if (inFlight.current === operation) inFlight.current = null;
    });
  }, [clientReleaseSha]);

  useEffect(() => {
    runCheck();
    const checkOnFocus = () => runCheck();
    const checkOnVisibility = () => {
      if (document.visibilityState === 'visible') runCheck();
    };
    window.addEventListener('focus', checkOnFocus);
    document.addEventListener('visibilitychange', checkOnVisibility);
    return () => {
      window.removeEventListener('focus', checkOnFocus);
      document.removeEventListener('visibilitychange', checkOnVisibility);
      generation.current += 1;
      if (inFlight.current !== null) {
        window.clearTimeout(inFlight.current.timeoutId);
        inFlight.current.controller.abort();
      }
      inFlight.current = null;
    };
  }, [runCheck]);

  if (status === 'checking' || status === 'match') return null;

  if (status === 'unknown') {
    return (
      <div
        className="flex flex-col gap-3 rounded-micro border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-50 sm:flex-row sm:items-center sm:justify-between"
        role="status"
        data-staff-role={staffRole}
      >
        <span>Version impossible à vérifier</span>
        <Button type="button" variant="outline" onClick={() => runCheck(true)}>Réessayer</Button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-micro border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-50 sm:flex-row sm:items-center sm:justify-between"
      role="alert"
      data-staff-role={staffRole}
    >
      <span>Une nouvelle version de Nexus est disponible — Recharger</span>
      <Button type="button" variant="outline" onClick={reloadPage}>Recharger</Button>
    </div>
  );
}
