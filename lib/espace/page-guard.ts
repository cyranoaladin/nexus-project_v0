/** Garde des pages serveur : redirige vers la connexion ou vers l'espace du bon rôle. */
import { redirect } from 'next/navigation';

import { getEspaceActor, type EspaceActor, type EspaceRole } from './guards';

export function homeFor(role: EspaceRole): string {
  return role === 'ELEVE' ? '/espace/eleve' : '/espace/enseignant';
}

export async function requireActorForPage(allowed: readonly EspaceRole[], returnTo: string): Promise<EspaceActor> {
  const actor = await getEspaceActor();
  if (!actor) redirect(`/espace/connexion?callbackUrl=${encodeURIComponent(returnTo)}`);
  if (!allowed.includes(actor.role)) redirect(homeFor(actor.role));
  return actor;
}
