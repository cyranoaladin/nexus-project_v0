'use client';
import { useSearchParams } from 'next/navigation';
import { useCanonicalSession } from '@/components/auth/SessionRecoveryProvider';
import { useCoreMembership } from './use-core-membership';

/** Business API surface, independently of the credential authority. */
export function useAriaSurface() {
  const membership = useCoreMembership();
  const session = useCanonicalSession();
  const search = useSearchParams();
  let surface: 'V1' | 'CORE_V2' | null = null;
  if (session.status === 'authenticated' && session.data?.user.authority === 'V1') {
    if (search.get('surface') === 'v1') surface = session.data.user.role === 'ELEVE' ? 'V1' : null;
    else if (membership.state === 'ACTIVE') surface = membership.role === 'ELEVE' ? 'CORE_V2' : null;
    else if (membership.state === 'NOT_MEMBER' || membership.state === 'NOT_ENABLED')
      surface = session.data.user.role === 'ELEVE' ? 'V1' : null;
  }
  return { surface, membership, identityId: session.status === 'authenticated' ? session.data?.user.id ?? null : null };
}
