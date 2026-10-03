import { listAttachments, saveAttachment, MAX_UPLOAD_BYTES } from '@/lib/espace/files';
import { assertSameOrigin, guarded, json } from '@/lib/espace/http';
import { EspaceError } from '@/lib/espace/errors';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { id } = await params;
  return guarded(request, { roles: ['ELEVE', 'COACH', 'ADMIN'] }, async (actor) => json({ attachments: await listAttachments(actor, id) }));
}

/** Dépôt d'une copie (PDF/JPEG/PNG). Le type est vérifié sur les octets, pas sur l'en-tête. */
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  return guarded(request, { roles: ['ELEVE'], mutate: true, rate: 'espace-upload' }, async (actor) => {
    assertSameOrigin(request);
    const declared = Number(request.headers.get('content-length') ?? '0');
    if (declared > MAX_UPLOAD_BYTES + 64 * 1024) throw new EspaceError('UPLOAD_REJECTED', 'Fichier trop volumineux (8 Mo maximum)');
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new EspaceError('UPLOAD_REJECTED', 'Envoi invalide');
    }
    const file = form.get('file');
    if (!(file instanceof File)) throw new EspaceError('UPLOAD_REJECTED', 'Aucun fichier reçu');
    const bytes = new Uint8Array(await file.arrayBuffer());
    return json({ attachment: await saveAttachment(actor, id, { name: file.name, bytes }) }, 201);
  });
}
