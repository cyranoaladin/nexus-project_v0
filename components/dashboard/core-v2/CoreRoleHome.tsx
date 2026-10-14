'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCanonicalSession } from '@/components/auth/SessionRecoveryProvider';
import { getRoleDestination } from '@/lib/auth/role-destinations';
import { useCoreMembership, type CoreBusinessRole } from '@/hooks/use-core-membership';

export function V1SpaceLink() {
  const session = useCanonicalSession();
  const destination = getRoleDestination(session.data?.user.role) ?? '/dashboard';
  return <Link href={`${destination}?surface=v1`} prefetch={false} className="underline">Accéder à mon espace V1</Link>;
}
export function CoreMembershipNotice({ membership }: { membership: ReturnType<typeof useCoreMembership> }) {
  if (membership.state === 'LOADING') return <p role="status">Vérification de votre espace académique…</p>;
  if (membership.state === 'UNAUTHENTICATED') return <Link href="/auth/signin">Se connecter</Link>;
  return <div role={membership.state === 'UNAVAILABLE' ? 'alert' : 'status'} className="space-y-3 rounded border border-white/20 p-4">
    <p>{membership.state === 'INACTIVE' ? 'Votre accès à cet espace académique est suspendu. Votre espace V1 reste disponible.'
      : membership.state === 'UNAVAILABLE' ? 'La vérification de votre accès académique est momentanément indisponible.'
        : 'Cet espace académique n’est pas activé pour votre compte.'}</p>
    {membership.state === 'UNAVAILABLE' && <button type="button" onClick={membership.retry} className="mr-4 underline">Réessayer</button>}
    <V1SpaceLink />
  </div>;
}

/** Core membership chooses this surface; the credential authority remains V1. */
export function CoreRoleHome({ role, legacy, children }: { role: CoreBusinessRole; legacy: React.ReactNode; children: React.ReactNode }) {
  const membership = useCoreMembership();
  const session = useCanonicalSession();
  const search = useSearchParams();
  if (search.get('surface') === 'v1' && session.status === 'authenticated' && session.data?.user.authority === 'V1'
    || membership.state === 'NOT_MEMBER' || membership.state === 'NOT_ENABLED') return <>
    <Link href="/dashboard/core" prefetch={false} className="mb-4 inline-block underline">Mon espace académique</Link>{legacy}
  </>;
  if (membership.state !== 'ACTIVE') return <CoreMembershipNotice membership={membership} />;
  if (membership.role !== role) return <div className="space-y-4">
    <Link href="/dashboard/core" prefetch={false} className="block underline">Ouvrir mon espace académique</Link><V1SpaceLink />
  </div>;
  return <div className="space-y-4"><V1SpaceLink />{children}</div>;
}
