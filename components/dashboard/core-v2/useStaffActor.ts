'use client';

import { useEffect, useState } from 'react';
import { type ApiFail, type StaffActor, v2 } from './api';

/** Who the signed-in staff member is for Core v2, and which actions the UI may offer. */
export function useStaffActor() {
  const [me, setMe] = useState<StaffActor | null>(null);
  const [failure, setFailure] = useState<ApiFail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void v2<StaffActor>('/staff/me').then((result) => {
      if (cancelled) return;
      if (result.ok) setMe(result.data);
      else setFailure(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const can = (capability: string) => me?.capabilities.includes(capability) ?? false;
  return { me, failure, loading, can };
}
