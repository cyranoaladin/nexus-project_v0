/**
 * Enveloppe commune des routes d'API de l'espace pédagogique.
 *
 *  - session + rôle recontrôlés (guards) ;
 *  - rate-limit par scope, jamais d'identité dans les journaux ;
 *  - mutations : `Content-Type: application/json` obligatoire et `Origin`
 *    identique à l'hôte quand il est présent (défense CSRF en plus du cookie
 *    SameSite) ;
 *  - corps JSON borné ; erreurs sobres, sans contenu d'élève ni chemin.
 */
import { Readable } from 'node:stream';

import { NextResponse } from 'next/server';

import { safeContentType, safeFilename } from '@/lib/documents/secure-file-access';
import { guardSensitiveRateLimit, type SensitiveRateLimitScope } from '@/lib/rate-limit/sensitive';

import { EspaceError } from './errors';
import { errorResponse, isResponse, requireEspaceActor, type EspaceActor, type EspaceRole } from './guards';
import type { OpenedFile } from './files';

export const MAX_JSON_BYTES = 512 * 1024;

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  if (!origin) return; // appels serveur-à-serveur ou même origine sans en-tête
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new EspaceError('FORBIDDEN', 'Origine refusée');
  }
  if (!host || originHost !== host) throw new EspaceError('FORBIDDEN', 'Origine refusée');
}

export async function readJson(request: Request): Promise<unknown> {
  const type = request.headers.get('content-type') ?? '';
  if (!type.toLowerCase().startsWith('application/json')) throw new EspaceError('INVALID_INPUT', 'Corps JSON attendu');
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_JSON_BYTES) throw new EspaceError('INVALID_INPUT', 'Requête trop volumineuse');
  const text = await request.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_JSON_BYTES) throw new EspaceError('INVALID_INPUT', 'Requête trop volumineuse');
  try {
    return JSON.parse(text);
  } catch {
    throw new EspaceError('INVALID_INPUT', 'JSON invalide');
  }
}

export interface GuardOptions {
  roles: readonly EspaceRole[];
  /** Vrai pour toute écriture : active les contrôles d'origine. */
  mutate?: boolean;
  rate?: SensitiveRateLimitScope;
}

export async function guarded(
  request: Request,
  options: GuardOptions,
  handler: (actor: EspaceActor) => Promise<NextResponse | unknown>,
): Promise<NextResponse> {
  try {
    if (options.mutate) assertSameOrigin(request);
    const actor = await requireEspaceActor(options.roles);
    if (isResponse(actor)) return actor;
    if (options.rate) {
      const blocked = await guardSensitiveRateLimit(request, { scope: options.rate, identity: actor.id });
      if (blocked) {
        // La réponse du limiteur porte des détails internes : le client reçoit un message sobre.
        return json({ error: 'RATE_LIMITED', message: 'Trop de requêtes, réessayez dans un instant' }, blocked.status === 503 ? 503 : 429);
      }
    }
    const result = await handler(actor);
    return result instanceof NextResponse ? result : json(result);
  } catch (e) {
    return errorResponse(e);
  }
}

export function fileResponse(file: OpenedFile): NextResponse {
  const stream = file.doc.handle.createReadStream();
  const web = Readable.toWeb(stream) as ReadableStream;
  return new NextResponse(web, {
    headers: {
      'Content-Type': safeContentType(file.mimeType),
      'Content-Disposition': `attachment; filename="${safeFilename(file.filename)}"`,
      'Content-Length': file.doc.sizeBytes.toString(),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}
