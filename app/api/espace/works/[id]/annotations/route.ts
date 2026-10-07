import { addAnnotation, listAnnotations } from '@/lib/espace/annotations';
import { guarded, json, readJson } from '@/lib/espace/http';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { id } = await params;
  return guarded(request, { roles: ['ELEVE', 'COACH', 'ADMIN'] }, async (actor) => json({ annotations: await listAnnotations(actor, id) }));
}

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  return guarded(request, { roles: ['COACH', 'ADMIN'], mutate: true, rate: 'espace-teacher-write' }, async (actor) =>
    json({ annotation: await addAnnotation(actor, id, await readJson(request)) }, 201),
  );
}
