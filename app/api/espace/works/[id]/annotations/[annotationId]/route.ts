import { deleteAnnotation } from '@/lib/espace/annotations';
import { guarded, json } from '@/lib/espace/http';

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; annotationId: string }> }) {
  const { id, annotationId } = await params;
  return guarded(request, { roles: ['COACH', 'ADMIN'], mutate: true, rate: 'espace-teacher-write' }, async (actor) => {
    await deleteAnnotation(actor, id, annotationId);
    return json({ ok: true });
  });
}
