import { addSnippet, listSnippets } from '@/lib/espace/annotations';
import { guarded, json, readJson } from '@/lib/espace/http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return guarded(request, { roles: ['COACH', 'ADMIN'] }, async (actor) => json({ snippets: await listSnippets(actor) }));
}

export async function POST(request: Request) {
  return guarded(request, { roles: ['COACH', 'ADMIN'], mutate: true, rate: 'espace-teacher-write' }, async (actor) =>
    json({ snippet: await addSnippet(actor, await readJson(request)) }, 201),
  );
}
