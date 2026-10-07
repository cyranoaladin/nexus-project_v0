import { publishSession } from '@/lib/espace/sessions';
import { guarded, json } from '@/lib/espace/http';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guarded(request, { roles: ['COACH', 'ADMIN'], mutate: true, rate: 'espace-teacher-write' }, async (actor) => json({ session: await publishSession(actor, id) }));
}
