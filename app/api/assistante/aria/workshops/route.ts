export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { unauthorizedAriaResponse } from '@/lib/aria/transport/session';
import { readBoundedAriaJson } from '@/lib/aria/transport/read-json-body';
import { scheduleAriaWorkshopSession } from '@/lib/aria/application/workshop/schedule-workshop';
import { listAriaWorkshopsForStaff } from '@/lib/aria/application/workshop/list-workshops-for-staff';
import { createLogger } from '@/lib/middleware/logger';
import { AriaError, toAriaErrorResponse } from '@/lib/aria/errors';

const scheduleWorkshopSchema = z.object({
  courseKey: z.string().min(1),
  title: z.string().min(1),
  scheduledDate: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  modality: z.enum(['ONLINE', 'IN_PERSON', 'HYBRID']),
  location: z.string().nullish(),
  capacity: z.number().int().positive().nullish(),
  coachProfileId: z.string().nullish(),
}).strict();

export async function POST(request: NextRequest) {
  const logger = createLogger(request);
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'ASSISTANTE') {
      return unauthorizedAriaResponse(logger);
    }

    const body = await readBoundedAriaJson(request);
    let validated: z.infer<typeof scheduleWorkshopSchema>;
    try {
      validated = scheduleWorkshopSchema.parse(body);
    } catch {
      throw new AriaError('BAD_REQUEST', 400, 'Requête de planification ARIA invalide.');
    }

    const workshop = await scheduleAriaWorkshopSession({
      actor: { userId: session.user.id, role: session.user.role },
      courseKey: validated.courseKey,
      title: validated.title,
      scheduledDate: new Date(validated.scheduledDate),
      startTime: validated.startTime,
      endTime: validated.endTime,
      modality: validated.modality,
      location: validated.location,
      capacity: validated.capacity,
      coachProfileId: validated.coachProfileId,
    });
    return NextResponse.json({ workshop });
  } catch (error) {
    return toAriaErrorResponse(error, logger);
  }
}

export async function GET(request: NextRequest) {
  const logger = createLogger(request);
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'ASSISTANTE') {
      return unauthorizedAriaResponse(logger);
    }

    const { searchParams } = new URL(request.url);
    const courseKey = searchParams.get('courseKey') ?? undefined;

    const workshops = await listAriaWorkshopsForStaff({
      actor: { userId: session.user.id, role: session.user.role },
      courseKey,
    });
    return NextResponse.json({ workshops });
  } catch (error) {
    return toAriaErrorResponse(error, logger);
  }
}
