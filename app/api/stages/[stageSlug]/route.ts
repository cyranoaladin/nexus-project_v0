export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getPublicStageBySlug } from '@/lib/stages/public';
import { getPreRentreeReleaseGate } from '@/lib/campaigns/pre-rentree-2026/release-gate';

const paramsSchema = z.object({
  stageSlug: z.string().min(1).max(160).regex(/^[a-z0-9-]+$/i),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ stageSlug: string }> }
) {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }
  const { stageSlug } = parsedParams.data;
  if (stageSlug === 'pre-rentree-2026' && !getPreRentreeReleaseGate().isPublicReady) {
    return NextResponse.json({ error: 'Stage introuvable' }, { status: 404 });
  }

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
