import { deleteAttachment, openAttachment } from '@/lib/espace/files';
import { fileResponse, guarded, json } from '@/lib/espace/http';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string; attachmentId: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { id, attachmentId } = await params;
  return guarded(request, { roles: ['ELEVE', 'COACH', 'ADMIN'] }, async (actor) => {
    const file = await openAttachment(actor, id, attachmentId);
    try {
      return fileResponse(file);
    } catch (e) {
      await file.doc.handle.close().catch(() => undefined);
      throw e;
    }
  });
}

export async function DELETE(request: Request, { params }: Ctx) {
  const { id, attachmentId } = await params;
  return guarded(request, { roles: ['ELEVE'], mutate: true, rate: 'espace-upload' }, async (actor) => {
    await deleteAttachment(actor, id, attachmentId);
    return json({ ok: true });
  });
}
