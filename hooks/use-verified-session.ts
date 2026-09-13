'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCanonicalSession } from '@/components/auth/SessionRecoveryProvider';

/** Role presentation guard; identity recovery belongs to the shared owner. */
export function useVerifiedSession(role: string, redirect = '/auth/signin') {
  const session = useCanonicalSession();
  const router = useRouter();
  useEffect(() => {
    if (session.status === 'unauthenticated' || (session.data && session.data.user.role !== role)) router.replace(redirect);
  }, [session, role, redirect, router]);
  return session;
}
