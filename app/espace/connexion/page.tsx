import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getEspaceActor } from '@/lib/espace/guards';
import { homeFor } from '@/lib/espace/page-guard';

import { ConnexionForm } from './ConnexionForm';

export const metadata: Metadata = { title: 'Connexion' };
export const dynamic = 'force-dynamic';

export default async function ConnexionPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const actor = await getEspaceActor();
  if (actor) redirect(homeFor(actor.role));
  const { callbackUrl } = await searchParams;
  return <ConnexionForm callbackUrl={callbackUrl} />;
}
