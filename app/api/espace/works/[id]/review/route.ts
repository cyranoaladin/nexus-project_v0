import { guarded, json, readJson } from '@/lib/espace/http';
import { EspaceError } from '@/lib/espace/errors';
import { reviewWork } from '@/lib/espace/works';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
const body = z.object({ action: z.enum(['MARK_CORRECTED', 'REOPEN', 'MARK_DONE']) }).strict();

/** Statut de correction : corrigé, à reprendre, terminé. L'enseignant ne modifie jamais le contenu. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guarded(request, { roles: ['COACH', 'ADMIN'], mutate: true, rate: 'espace-teacher-write' }, async (actor) => {
    const parsed = body.safeParse(await readJson(request));
    if (!parsed.success) throw new EspaceError('INVALID_INPUT', 'Requête invalide');
    return json({ work: await reviewWork(actor, id, parsed.data.action) });
  });
}
