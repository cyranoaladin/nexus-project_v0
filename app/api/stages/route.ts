export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { listPublicStages } from '@/lib/stages/public';

const querySchema = z.object({
  open: z.string().optional(),
  level: z.string().optional(),
  subject: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }

  try {
    const stages = await listPublicStages({
      open: parsed.data.open === 'true',
      level: parsed.data.level,
      subject: parsed.data.subject,
    });

    return NextResponse.json({ stages });
  } catch (error) {
    console.error('[GET /api/stages]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
