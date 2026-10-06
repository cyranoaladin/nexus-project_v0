import { loadWorkForActor } from '@/lib/espace/access';
import { listAnnotations } from '@/lib/espace/annotations';
import { listAttachments } from '@/lib/espace/files';
import { guarded, json, readJson } from '@/lib/espace/http';
import { EspaceError } from '@/lib/espace/errors';
import { saveWork, toWorkDto } from '@/lib/espace/works';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

/** Travail + retours visibles + pièces jointes. Élève propriétaire ou enseignant du groupe. */
export async function GET(request: Request, { params }: Ctx) {
  const { id } = await params;
  return guarded(request, { roles: ['ELEVE', 'COACH', 'ADMIN'] }, async (actor) => {
    const { work, mode } = await loadWorkForActor(actor, id);
    const [annotations, attachments] = await Promise.all([listAnnotations(actor, id), listAttachments(actor, id)]);
    return json({ mode, work: toWorkDto(work), annotations, attachments });
  });
}

const saveBody = z
  .object({
    baseRevision: z.number().int().min(0),
    patch: z.record(z.unknown()),
    currentStep: z.number().int().min(0).max(64).optional(),
    snapshot: z.enum(['STEP_CHANGE', 'RUN']).optional(),
  })
  .strict();

/** Autosave d'une étape, conditionné par la révision sur laquelle le client s'appuie. */
export async function PUT(request: Request, { params }: Ctx) {
  const { id } = await params;
  return guarded(request, { roles: ['ELEVE'], mutate: true, rate: 'espace-autosave' }, async (actor) => {
    const parsed = saveBody.safeParse(await readJson(request));
    if (!parsed.success) throw new EspaceError('INVALID_INPUT', 'Requête invalide');
    return json(await saveWork(actor, id, parsed.data));
  });
}
