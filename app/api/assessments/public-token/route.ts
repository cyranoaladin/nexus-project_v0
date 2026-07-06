export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Subject } from '@/lib/assessments/core/types';
import { createAssessmentPublicToken, verifyAssessmentPublicToken } from '@/lib/assessments/public-token';
import { guardRateLimitAsync } from '@/lib/rate-limit';
import { isErrorResponse, requireAnyRole } from '@/lib/guards';

const publicTokenRequestSchema = z.object({
  subject: z.nativeEnum(Subject),
  grade: z.enum(['PREMIERE', 'TERMINALE']),
  source: z.string().trim().min(1).max(80).optional(),
  campaignId: z.string().trim().min(1).max(80).optional(),
}).strict();

export async function POST(request: NextRequest) {
  const sessionOrResponse = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
  if (isErrorResponse(sessionOrResponse)) {
    return sessionOrResponse;
  }

  const blocked = await guardRateLimitAsync(request, {
    preset: 'api',
    keySuffix: 'assessments-public-token',
    userId: sessionOrResponse.user.id,
  });
  if (blocked) return blocked;

  const body = await request.json().catch(() => null);
  const parsed = publicTokenRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  }

  const token = createAssessmentPublicToken(parsed.data);
  const verification = verifyAssessmentPublicToken(token, {
    usage: 'assessment_submit',
    subject: parsed.data.subject,
    grade: parsed.data.grade,
  });

  if (!verification.valid) {
    return NextResponse.json({ error: 'Token unavailable' }, { status: 500 });
  }

  return NextResponse.json({
    token,
    expiresAt: new Date(verification.payload.expiresAt * 1000).toISOString(),
  });
}
