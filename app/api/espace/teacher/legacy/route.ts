import { guarded, json } from '@/lib/espace/http';
import { getLegacyArchiveView } from '@/lib/espace/legacy/snapshot';

export const dynamic = 'force-dynamic';

/** Lecture seule : résumé de l'archive POO historique + statut d'association. Aucune écriture possible ici. */
export async function GET(request: Request) {
  return guarded(request, { roles: ['COACH', 'ADMIN'] }, async () => json(await getLegacyArchiveView()));
}
