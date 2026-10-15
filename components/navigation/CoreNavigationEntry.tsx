'use client';
import Link from 'next/link';
import { useCoreMembership } from '@/hooks/use-core-membership';
export function CoreNavigationEntry() {
  const membership = useCoreMembership();
  if (!['ACTIVE', 'INACTIVE', 'UNAVAILABLE'].includes(membership.state)) return null;
  return <Link href="/dashboard/core" prefetch={false} className="block text-sm underline">Mon espace académique</Link>;
}
