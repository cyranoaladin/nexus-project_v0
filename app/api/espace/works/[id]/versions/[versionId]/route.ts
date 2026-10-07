import { loadWorkForActor } from '@/lib/espace/access';
import { EspaceError } from '@/lib/espace/errors';
import { guarded, json } from '@/lib/espace/http';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** Contenu d'un instantané — enseignant. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  const { id, versionId } = await params;
  return guarded(request, { roles: ['COACH', 'ADMIN'] }, async (actor) => {
    await loadWorkForActor(actor, id, 'teacher');
    const version = await prisma.espaceWorkVersion.findFirst({ where: { id: versionId, workId: id } });
    if (!version) throw new EspaceError('NOT_FOUND', 'Version introuvable');
    return json({ version: { id: version.id, revision: version.revision, reason: version.reason, createdAt: version.createdAt, content: version.content } });
  });
}
