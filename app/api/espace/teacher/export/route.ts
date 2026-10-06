import { NextResponse } from 'next/server';

import { EspaceError } from '@/lib/espace/errors';
import { buildExport, serializeExport, type ExportScope } from '@/lib/espace/export';
import { guarded } from '@/lib/espace/http';

export const dynamic = 'force-dynamic';

const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Export JSON (audit / sauvegarde / portabilité) : ?workId= | ?sessionId= | ?studentId= — un seul. */
export async function GET(request: Request) {
  return guarded(request, { roles: ['COACH', 'ADMIN'] }, async (actor) => {
    const params = new URL(request.url).searchParams;
    const candidates: [ExportScope['kind'], string | null][] = [
      ['work', params.get('workId')],
      ['session', params.get('sessionId')],
      ['student', params.get('studentId')],
    ];
    const given = candidates.filter(([, id]) => id !== null);
    if (given.length !== 1) throw new EspaceError('INVALID_INPUT', 'Indiquez exactement un de : workId, sessionId, studentId');
    const [kind, id] = given[0]!;
    if (!id || !ID.test(id)) throw new EspaceError('INVALID_INPUT', 'Identifiant invalide');

    const body = serializeExport(await buildExport(actor, { kind, id }));
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="espace-export-${kind}-${new Date().toISOString().slice(0, 10)}.json"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  });
}
