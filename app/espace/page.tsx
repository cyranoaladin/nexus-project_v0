import { redirect } from 'next/navigation';

import { getEspaceActor } from '@/lib/espace/guards';
import { homeFor } from '@/lib/espace/page-guard';

export const dynamic = 'force-dynamic';

/** Point d'entrée unique : chacun arrive sur son tableau de bord selon son rôle. */
export default async function EspaceIndex() {
  const actor = await getEspaceActor();
  if (!actor) redirect('/espace/connexion');
  redirect(homeFor(actor.role));
}
