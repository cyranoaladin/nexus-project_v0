import { loadWorkForActor } from '@/lib/espace/access';
import { guarded, json } from '@/lib/espace/http';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** Historique des instantanés (métadonnées seulement) — enseignant. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guarded(request, { roles: ['COACH', 'ADMIN'] }, async (actor) => {
    await loadWorkForActor(actor, id, 'teacher');
    const versions = await prisma.espaceWorkVersion.findMany({
      where: { workId: id },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: { id: true, revision: true, reason: true, createdAt: true },
    });
    return json({ versions });
  });
}
