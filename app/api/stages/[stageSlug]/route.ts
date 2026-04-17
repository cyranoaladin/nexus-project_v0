export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

import { getPublicStageBySlug } from '@/lib/stages/public';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ stageSlug: string }> }
) {
  const { stageSlug } = await params;

  try {
    const stage = await getPublicStageBySlug(stageSlug);

    if (!stage) {
      return NextResponse.json({ error: 'Stage introuvable' }, { status: 404 });
    }

    return NextResponse.json({ stage });
  } catch (error) {
    console.error('[GET /api/stages/[slug]]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
