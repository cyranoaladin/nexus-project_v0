import { guarded, json, readJson } from '@/lib/espace/http';
import { EspaceError } from '@/lib/espace/errors';
import { submitWork } from '@/lib/espace/works';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
const body = z.object({ baseRevision: z.number().int().min(0) }).strict();

/** Remise volontaire par l'élève. Après remise : lecture seule jusqu'à « à reprendre ». */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guarded(request, { roles: ['ELEVE'], mutate: true, rate: 'espace-autosave' }, async (actor) => {
    const parsed = body.safeParse(await readJson(request));
    if (!parsed.success) throw new EspaceError('INVALID_INPUT', 'Requête invalide');
    return json({ work: await submitWork(actor, id, parsed.data.baseRevision) });
  });
}
