import { auth } from '@/auth';
import { AriaError } from '@/lib/aria/errors';
import { searchProgrammeResourcesV2 } from '@/lib/programme/rag-v2';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const bodySchema = z.object({
  chapId: z.string().trim().min(1).max(100),
  chapTitre: z.string().trim().min(1).max(200),
  query: z.string().trim().min(1).max(2_000).optional(),
}).strict();

function privateNoStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

function privateJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

export async function handleProgrammeRagV2Request(
  request: NextRequest,
  configuration: {
    readonly courseKey: string;
    readonly enrichQuery: (chapterTitle: string, chapterId: string, query?: string) => string;
  },
): Promise<NextResponse> {
  const ipBlocked = await guardSensitiveRateLimit(request, {
    scope: 'programme-rag-v2',
    dimensions: ['ip'],
  });
  if (ipBlocked) return privateNoStore(ipBlocked);

  const session = await auth();
  if (!session?.user || session.user.role !== 'ELEVE') {
    return privateJson({ error: 'Non authentifié' }, 401);
  }

  const identityBlocked = await guardSensitiveRateLimit(request, {
    scope: 'programme-rag-v2',
    identity: session.user.id,
    dimensions: ['identity'],
  });
  if (identityBlocked) return privateNoStore(identityBlocked);

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return privateJson({ error: 'Corps JSON invalide' }, 400);
  }

  try {
    const parsed = bodySchema.safeParse(requestBody);
    if (!parsed.success) {
      return privateJson({ error: 'Requête invalide' }, 422);
    }
    const result = await searchProgrammeResourcesV2({
      actor: { userId: session.user.id, role: session.user.role },
      courseKey: configuration.courseKey,
      query: configuration.enrichQuery(
        parsed.data.chapTitre,
        parsed.data.chapId,
        parsed.data.query,
      ),
    });
    return privateJson(result);
  } catch (error: unknown) {
    if (error instanceof AriaError) {
      return privateJson({ error: error.message }, error.status);
    }
    return privateJson({ error: 'Service documentaire indisponible' }, 503);
  }
}
