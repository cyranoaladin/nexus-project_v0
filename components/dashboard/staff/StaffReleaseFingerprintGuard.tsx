'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { CLIENT_RELEASE_SHA, canonicalReleaseSha } from '@/lib/release-fingerprint';

type StaffRole = 'ADMIN' | 'ASSISTANTE';

export function StaffReleaseFingerprintGuard({
  staffRole,
  clientReleaseSha = CLIENT_RELEASE_SHA,
  reloadPage = () => window.location.reload(),
}: {
  staffRole: StaffRole;
  clientReleaseSha?: string | null;
  reloadPage?: () => void;
}) {
  const [reloadRequired, setReloadRequired] = useState(false);

  useEffect(() => {
    let active = true;
    const canonicalClientSha = canonicalReleaseSha(clientReleaseSha);
    if (canonicalClientSha === null) {
      setReloadRequired(true);
      return () => { active = false; };
    }

    void fetch('/api/health', {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-store' },
    }).then(async (response) => {
      const body = await response.json() as { releaseSha?: unknown };
      const canonicalServerSha = canonicalReleaseSha(body.releaseSha);
      if (active && (canonicalServerSha === null || canonicalServerSha !== canonicalClientSha)) {
        setReloadRequired(true);
      }
    }).catch(() => {
      if (active) setReloadRequired(true);
    });

    return () => { active = false; };
  }, [clientReleaseSha]);

  if (!reloadRequired) return null;

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
