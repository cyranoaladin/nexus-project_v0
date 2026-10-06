import { createSession, listSessionsForTeacher } from '@/lib/espace/sessions';
import { guarded, json, readJson } from '@/lib/espace/http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return guarded(request, { roles: ['COACH', 'ADMIN'] }, async (actor) => json({ sessions: await listSessionsForTeacher(actor) }));
}

export async function POST(request: Request) {
  return guarded(request, { roles: ['COACH', 'ADMIN'], mutate: true, rate: 'espace-teacher-write' }, async (actor) =>
    json({ session: await createSession(actor, await readJson(request)) }, 201),
  );
}
