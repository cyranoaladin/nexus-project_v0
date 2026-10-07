import { guarded, json } from '@/lib/espace/http';
import { EspaceError } from '@/lib/espace/errors';
import { getTeacherOverview } from '@/lib/espace/overview';

export const dynamic = 'force-dynamic';

/** Cible de rafraîchissement du suivi en séance (le client interroge à intervalle raisonnable). */
export async function GET(request: Request) {
  return guarded(request, { roles: ['COACH', 'ADMIN'] }, async (actor) => {
    const slug = new URL(request.url).searchParams.get('activity');
    if (!slug || slug.length > 100) throw new EspaceError('INVALID_INPUT', 'Activité requise');
    return json(await getTeacherOverview(actor, slug));
  });
}
