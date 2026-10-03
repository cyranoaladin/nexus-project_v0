import { z } from 'zod';

import { changeOwnCredential } from '@/lib/espace/credentials';
import { EspaceError } from '@/lib/espace/errors';
import { guarded, json, readJson } from '@/lib/espace/http';

export const dynamic = 'force-dynamic';

// Aucun identifiant d'utilisateur dans le corps : la cible est TOUJOURS l'utilisateur de la session.
const body = z.object({ current: z.string().max(200), next: z.string().max(200), confirm: z.string().max(200) }).strict();

/** Changement autonome du code personnel (élève) ou du mot de passe (enseignant). */
export async function POST(request: Request) {
  return guarded(request, { roles: ['ELEVE', 'COACH', 'ADMIN'], mutate: true, rate: 'espace-credential' }, async (actor) => {
    const parsed = body.safeParse(await readJson(request));
    if (!parsed.success) throw new EspaceError('INVALID_INPUT', 'Requête invalide');
    await changeOwnCredential(actor, parsed.data);
    // Les sessions sont révoquées : le client doit se reconnecter avec le nouveau secret.
    return json({ ok: true, signedOut: true });
  });
}
