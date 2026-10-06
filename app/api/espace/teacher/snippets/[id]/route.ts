import { deleteSnippet } from '@/lib/espace/annotations';
import { guarded, json } from '@/lib/espace/http';

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guarded(request, { roles: ['COACH', 'ADMIN'], mutate: true, rate: 'espace-teacher-write' }, async (actor) => {
    await deleteSnippet(actor, id);
    return json({ ok: true });
  });
}
