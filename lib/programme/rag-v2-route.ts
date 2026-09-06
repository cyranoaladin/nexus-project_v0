import { auth } from '@/auth';
import { AriaError } from '@/lib/aria/errors';
import { searchProgrammeResourcesV2 } from '@/lib/programme/rag-v2';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const bodySchema = z.object({
  chapId: z.string().trim().min(1).max(100),
  chapTitre: z.string().trim().min(1).max(200),
  query: z.string().trim().min(1).max(2_000).optional(),
}).strict();

export async function handleProgrammeRagV2Request(
  request: NextRequest,
  configuration: {
    readonly courseKey: string;
    readonly enrichQuery: (chapterTitle: string, chapterId: string, query?: string) => string;
  },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ELEVE') {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Requête invalide' }, { status: 422 });
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
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
    }
    if (error instanceof AriaError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Service documentaire indisponible' }, { status: 503 });
  }
}
