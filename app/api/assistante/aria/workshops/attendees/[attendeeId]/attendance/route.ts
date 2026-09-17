export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { unauthorizedAriaResponse } from '@/lib/aria/transport/session';
import { readBoundedAriaJson } from '@/lib/aria/transport/read-json-body';
import { markAriaWorkshopAttendance } from '@/lib/aria/application/workshop/mark-attendance';
import { createLogger } from '@/lib/middleware/logger';
import { AriaError, toAriaErrorResponse } from '@/lib/aria/errors';

const markAttendanceSchema = z.object({ status: z.enum(['ATTENDED', 'ABSENT']) }).strict();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ attendeeId: string }> },
) {
  const logger = createLogger(request);
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'ASSISTANTE') {
      return unauthorizedAriaResponse(logger);
    }

    const { attendeeId } = await context.params;
    const body = await readBoundedAriaJson(request);
    let validated: z.infer<typeof markAttendanceSchema>;
    try {
      validated = markAttendanceSchema.parse(body);
    } catch {
      throw new AriaError('BAD_REQUEST', 400, 'Requête de présence ARIA invalide.');
    }

    const result = await markAriaWorkshopAttendance({
      actor: { userId: session.user.id, role: session.user.role },
      attendeeId,
      status: validated.status,
    });
    return NextResponse.json(result);
  } catch (error) {
    return toAriaErrorResponse(error, logger);
  }
}
