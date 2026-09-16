/**
 * POST /api/aria/bilans/periodic — staff-triggered generation of an ARIA
 * periodic bilan (P7b-1).
 *
 * Staff only (ADMIN/ASSISTANTE/COACH), same role set as the generic
 * `POST /api/bilans` — this is a specialised creation path for one
 * `BilanType`, not a new authority. The created bilan is always
 * `isPublished: false`: publication is a separate human-review step via the
 * existing `PUT /api/bilans/[id]` (P7b-2), never automatic here.
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isErrorResponse, requireAnyRole } from '@/lib/guards';
import { parseJsonBody } from '@/lib/api/helpers';
import { createLogger } from '@/lib/middleware/logger';
import { AriaError, toAriaErrorResponse } from '@/lib/aria/errors';
import { generateAndPersistAriaPeriodicBilan } from '@/lib/aria/bilans/periodic/generate-and-persist-periodic-bilan';

const bodySchema = z
  .object({
    studentId: z.string().trim().regex(/^[A-Za-z0-9_-]{1,191}$/),
    courseKey: z.string().trim().min(1).max(120),
    periodStart: z.string().datetime(),
    periodEnd: z.string().datetime(),
  })
  .strict();

export async function POST(request: NextRequest) {
  const logger = createLogger(request);
  const authResponse = await requireAnyRole(['ADMIN', 'ASSISTANTE', 'COACH']);
  if (isErrorResponse(authResponse)) return authResponse;

  try {
    let rawBody: unknown;
    try {
      rawBody = await parseJsonBody(request);
    } catch {
      throw new AriaError('BAD_REQUEST', 400, 'Requête invalide.');
    }
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AriaError('BAD_REQUEST', 400, 'Requête invalide.', { issues: parsed.error.issues });
    }

    const { studentId, courseKey, periodStart, periodEnd } = parsed.data;
    const result = await generateAndPersistAriaPeriodicBilan({
      studentId,
      courseKey,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
    });

    return NextResponse.json({
      bilanId: result.bilanId,
      totalAttemptsInPeriod: result.report.totalAttemptsInPeriod,
      globalScore: result.report.globalScore,
    });
  } catch (error) {
    return toAriaErrorResponse(error, logger);
  }
}
