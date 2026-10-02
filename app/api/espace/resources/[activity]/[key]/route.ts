import { openResource } from '@/lib/espace/files';
import { fileResponse, guarded } from '@/lib/espace/http';

export const dynamic = 'force-dynamic';

/** Ressource de cours. Un corrigé n'est jamais servi à un élève (404 uniforme). */
export async function GET(request: Request, { params }: { params: Promise<{ activity: string; key: string }> }) {
  const { activity, key } = await params;
  return guarded(request, { roles: ['ELEVE', 'COACH', 'ADMIN'] }, async (actor) => {
    const file = await openResource(actor, activity, key);
    try {
      return fileResponse(file);
    } catch (e) {
      await file.doc.handle.close().catch(() => undefined);
      throw e;
    }
  });
}
