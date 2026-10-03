/** Garde des pages serveur : redirige vers la connexion ou vers l'espace du bon rôle. */
import { redirect } from 'next/navigation';

import { getEspaceActor, type EspaceActor, type EspaceRole } from './guards';

export function homeFor(role: EspaceRole): string {
  return role === 'ELEVE' ? '/espace/eleve' : '/espace/enseignant';
}

export const CREDENTIAL_PAGE_STUDENT = '/espace/eleve/compte';
export const CREDENTIAL_PAGE_TEACHER = '/espace/enseignant/compte';

/**
 * `allowTemporaryCode` : seule la page « Mon compte » le demande. Partout ailleurs, un élève dont le code est
 * temporaire est d'abord conduit à en choisir un (le code initial devient alors inutilisable).
 */
export async function requireActorForPage(
  allowed: readonly EspaceRole[],
  returnTo: string,
  options: { allowTemporaryCode?: boolean } = {},
): Promise<EspaceActor> {
  const actor = await getEspaceActor();
  if (!actor) redirect(`/espace/connexion?callbackUrl=${encodeURIComponent(returnTo)}`);
  if (!allowed.includes(actor.role)) redirect(homeFor(actor.role));
  if (actor.mustChangeCredential && !options.allowTemporaryCode) redirect(`${CREDENTIAL_PAGE_STUDENT}?obligatoire=1`);
  return actor;
}
