import { openWork } from '@/lib/espace/works';
import { guarded, json, readJson } from '@/lib/espace/http';
import { EspaceError } from '@/lib/espace/errors';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const body = z.object({ activitySlug: z.string().min(1).max(100), sessionId: z.string().min(1).max(64).nullish() }).strict();

/** Ouvre (ou reprend) le travail de l'élève connecté sur une activité. Idempotent. */
export async function POST(request: Request) {
  return guarded(request, { roles: ['ELEVE'], mutate: true, rate: 'espace-autosave' }, async (actor) => {
    const parsed = body.safeParse(await readJson(request));
    if (!parsed.success) throw new EspaceError('INVALID_INPUT', 'Requête invalide');
    return json({ work: await openWork(actor, parsed.data) });
  });
}
