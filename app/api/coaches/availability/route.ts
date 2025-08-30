import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

function normalizeTime(time: string): string {
  const [h, m] = time.split(':').map((v) => parseInt(v, 10));
  const hh = String(isNaN(h) ? 0 : h).padStart(2, '0');
  const mm = String(isNaN(m) ? 0 : m).padStart(2, '0');
  return `${hh}:${mm}`;
}

// Validation schema for setting availability
const availabilitySchema = z.object({
  schedule: z.array(
    z.object({
      dayOfWeek: z.number().min(0).max(6), // 0 = Sunday, 6 = Saturday
      slots: z.array(
        z.object({
          startTime: z
            .string()
            .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
          endTime: z
            .string()
            .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
          modality: z.enum(['ONLINE', 'IN_PERSON']).default('ONLINE'),
          isAvailable: z.boolean().default(true),
        })
      ),
    })
  ),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
});

// Validation schema for specific date availability
const specificDateSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  slots: z.array(
    z.object({
      startTime: z
        .string()
        .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
      endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
      modality: z.enum(['ONLINE', 'IN_PERSON']).default('ONLINE'),
      isAvailable: z.boolean().default(true),
    })
  ),
});

function isEndAfterStart(startTime: string, endTime: string): boolean {
  return startTime < endTime;
}

function isExactlyOneHour(startTime: string, endTime: string): boolean {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return eh * 60 + em - (sh * 60 + sm) === 60;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'COACH') {
      return NextResponse.json({ error: 'Only coaches can set availability' }, { status: 403 });
    }

    const body = await req.json();
    const { type, ...data } = body;

    if (type === 'weekly') {
      const validatedData = availabilitySchema.parse(data);

      // Validate slot times and deduplicate
      const uniqueKeys = new Set<string>();
      for (const day of validatedData.schedule) {
        for (const slot of day.slots) {
          if (!isEndAfterStart(slot.startTime, slot.endTime)) {
            return NextResponse.json(
              {
                error: `Invalid time range ${slot.startTime}-${slot.endTime} for day ${day.dayOfWeek}`,
              },
              { status: 400 }
            );
          }
          const key = `${day.dayOfWeek}|${slot.startTime}|${slot.endTime}|${slot.modality}|weekly`;
          if (uniqueKeys.has(key)) {
            return NextResponse.json(
              { error: `Duplicate slot ${slot.startTime}-${slot.endTime} on day ${day.dayOfWeek}` },
              { status: 400 }
            );
          }
          uniqueKeys.add(key);
        }
      }

      // Clear existing weekly availability for the coach
      await prisma.coachAvailability.deleteMany({
        where: {
          coachId: session.user.id,
          isRecurring: true,
          specificDate: { equals: null },
        },
      });

      // Create new availability slots
      const availabilitySlots = [] as Array<any>;

      for (const day of validatedData.schedule) {
        for (const slot of day.slots) {
          availabilitySlots.push({
            coachId: session.user.id,
            dayOfWeek: day.dayOfWeek,
            startTime: normalizeTime(slot.startTime),
            endTime: normalizeTime(slot.endTime),
            modality: slot.modality,
            isAvailable: slot.isAvailable,
            isRecurring: true,
            validFrom: validatedData.validFrom ? new Date(validatedData.validFrom) : new Date(),
            validUntil: validatedData.validUntil ? new Date(validatedData.validUntil) : null,
          });
        }
      }

      if (availabilitySlots.length > 0) {
        try {
          await prisma.coachAvailability.createMany({ data: availabilitySlots });
        } catch (e: any) {
          if (e?.code === 'P2002') {
            return NextResponse.json(
              {
                error:
                  'Some slots conflict with existing ones (unique constraint). Please adjust times.',
              },
              { status: 409 }
            );
          }
          throw e;
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Weekly availability updated successfully',
        slotsCreated: availabilitySlots.length,
      });
    } else if (type === 'specific') {
      const validatedData = specificDateSchema.parse(data);

      const specificDate = new Date(validatedData.date);

      // Validate slot times and deduplicate for specific date
      const uniqueKeys = new Set<string>();
      for (const slot of validatedData.slots) {
        if (!isEndAfterStart(slot.startTime, slot.endTime)) {
          return NextResponse.json(
            {
              error: `Invalid time range ${slot.startTime}-${slot.endTime} for date ${validatedData.date}`,
            },
            { status: 400 }
          );
        }
        const key = `${specificDate.toDateString()}|${slot.startTime}|${slot.endTime}|${slot.modality}|specific`;
        if (uniqueKeys.has(key)) {
          return NextResponse.json(
            {
              error: `Duplicate slot ${slot.startTime}-${slot.endTime} for date ${validatedData.date}`,
            },
            { status: 400 }
          );
        }
        uniqueKeys.add(key);
      }

      // Clear existing availability for this specific date
      await prisma.coachAvailability.deleteMany({
        where: {
          coachId: session.user.id,
          specificDate: specificDate,
        },
      });

      // Create new availability slots for specific date
      const availabilitySlots = validatedData.slots.map((slot) => ({
        coachId: session.user.id,
        dayOfWeek: specificDate.getDay(),
        startTime: normalizeTime(slot.startTime),
        endTime: normalizeTime(slot.endTime),
        modality: slot.modality,
        isAvailable: slot.isAvailable,
        isRecurring: false,
        specificDate: specificDate,
      }));

      if (availabilitySlots.length > 0) {
        try {
          await prisma.coachAvailability.createMany({ data: availabilitySlots });
        } catch (e: any) {
          if (e?.code === 'P2002') {
            return NextResponse.json(
              {
                error:
                  'Some slots conflict with existing ones (unique constraint). Please adjust times.',
              },
              { status: 409 }
            );
          }
          throw e;
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Specific date availability updated successfully',
        date: validatedData.date,
        slotsCreated: availabilitySlots.length,
      });
    }

    return NextResponse.json(
      { error: 'Invalid availability type. Use "weekly" or "specific"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Set availability error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to set availability' },
      { status: 500 }
    );
  }
}

// GET - Get coach availability
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const coachId = searchParams.get('coachId') || session.user.id;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const modalityFilter = searchParams.get('modality'); // ONLINE | IN_PERSON | undefined

    // Only coaches can view their own availability, others can view any coach's availability
    if (session.user.role === 'COACH' && coachId !== session.user.id) {
      return NextResponse.json(
        { error: 'You can only view your own availability' },
        { status: 403 }
      );
    }

    // Build query conditions
    const whereConditions: any = {
      coachId: coachId,
      isAvailable: true,
    };
    if (modalityFilter && (modalityFilter === 'ONLINE' || modalityFilter === 'IN_PERSON')) {
      whereConditions.modality = modalityFilter;
    }

    if (startDate && endDate) {
      whereConditions.OR = [
        {
          // Recurring availability
          isRecurring: true,
          specificDate: { equals: null },
          validFrom: { lte: new Date(endDate) },
          OR: [{ validUntil: null }, { validUntil: { gte: new Date(startDate) } }],
        },
        {
          // Specific date availability
          isRecurring: false,
          specificDate: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
      ];
    }

    const availability = await prisma.coachAvailability.findMany({
      where: whereConditions,
      include: {
        coach: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    // Fetch coach modality capabilities
    const coachProfile = await prisma.coachProfile
      .findUnique({ where: { userId: coachId } })
      .catch(() => null);
    const coachCanOnline = coachProfile?.availableOnline ?? true;
    const coachCanInPerson = coachProfile?.availableInPerson ?? true;

    // Get existing bookings to check actual availability
    let bookedSlots = [] as any[];
    if (startDate && endDate) {
      bookedSlots = await prisma.sessionBooking.findMany({
        where: {
          coachId: coachId,
          scheduledDate: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
          status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] },
        },
        select: {
          scheduledDate: true,
          startTime: true,
          endTime: true,
          status: true,
        },
      });
    }

    // Generate available time slots for the requested period
    const availableSlots = generateAvailableSlots(availability, bookedSlots, startDate, endDate, {
      canOnline: coachCanOnline,
      canInPerson: coachCanInPerson,
      modalityFilter: modalityFilter as any,
    });

    return NextResponse.json({
      success: true,
      availability: availability,
      bookedSlots: bookedSlots,
      availableSlots: availableSlots,
      coach: availability[0]?.coach || null,
    });
  } catch (error) {
    console.error('Get availability error:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get availability' },
      { status: 500 }
    );
  }
}

// Helper function to generate available time slots
function generateAvailableSlots(
  availability: any[],
  bookedSlots: any[],
  startDate: string | null,
  endDate: string | null,
  opts?: {
    canOnline: boolean;
    canInPerson: boolean;
    modalityFilter?: 'ONLINE' | 'IN_PERSON' | undefined;
  }
) {
  if (!startDate || !endDate) return [];

  const slots: any[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Generate slots for each day in the range
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const dayOfWeek = date.getDay();

    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const dateStr = date.toISOString().split('T')[0];

    // Find availability for this day
    const dayAvailability = availability.filter(
      (av) =>
        (av.isRecurring && av.dayOfWeek === dayOfWeek) ||
        (!av.isRecurring &&
          av.specificDate &&
          new Date(av.specificDate).toDateString() === date.toDateString())
    );

    // Find bookings for this day
    const dayBookings = bookedSlots.filter(
      (booking) => new Date(booking.scheduledDate).toDateString() === date.toDateString()
    );

    // Process availability slots directly without splitting them
    for (const av of dayAvailability) {
      // Check for any booking that overlaps with the availability slot
      const isBooked = dayBookings.some(
        (booking) => booking.startTime < av.endTime && booking.endTime > av.startTime
      );
      if (isBooked) continue;

      // Business hours check
      const startHour = parseInt(av.startTime.split(':')[0]);
      const endHour = parseInt(av.endTime.split(':')[0]);
      if (startHour < 8 || endHour > 20) continue;

      // Determine modality to expose for this slot
      const avModality: 'ONLINE' | 'IN_PERSON' | undefined = (av as any).modality;
      const canOnline = opts?.canOnline ?? true;
      const canInPerson = opts?.canInPerson ?? true;

      const maybePush = (modality: 'ONLINE' | 'IN_PERSON') => {
        if (opts?.modalityFilter && opts.modalityFilter !== modality) return;
        slots.push({
          date: dateStr,
          dayOfWeek,
          startTime: av.startTime,
          endTime: av.endTime,
          duration: calculateDuration(av.startTime, av.endTime),
          modality,
          isRecurring: av.isRecurring,
          specificDate: av.specificDate,
        });
      };

      if (avModality === 'ONLINE') {
        if (canOnline) maybePush('ONLINE');
      } else if (avModality === 'IN_PERSON') {
        if (canInPerson) maybePush('IN_PERSON');
      } else {
        // Fallback legacy: expose both based on coach capability
        if (canOnline) maybePush('ONLINE');
        if (canInPerson) maybePush('IN_PERSON');
      }
    }
  }

  return slots.sort((a, b) => {
    const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (dateCompare !== 0) return dateCompare;
    return a.startTime.localeCompare(b.startTime);
  });
}

function calculateDuration(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  return endHour * 60 + endMin - (startHour * 60 + startMin);
}

// DELETE - Remove specific availability slot
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'COACH') {
      return NextResponse.json({ error: 'Only coaches can delete availability' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const availabilityId = searchParams.get('id');

    if (!availabilityId) {
      return NextResponse.json({ error: 'Availability ID is required' }, { status: 400 });
    }

    // Verify the availability belongs to the coach
    const availability = await prisma.coachAvailability.findFirst({
      where: {
        id: availabilityId,
        coachId: session.user.id,
      },
    });

    if (!availability) {
      return NextResponse.json({ error: 'Availability slot not found' }, { status: 404 });
    }

    // Check if there are any scheduled sessions during this time
    const conflictingSessions = await prisma.sessionBooking.findMany({
      where: {
        coachId: session.user.id,
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        OR: availability.specificDate
          ? [{ scheduledDate: availability.specificDate }]
          : [
              {
                AND: [
                  { startTime: { gte: availability.startTime } },
                  { endTime: { lte: availability.endTime } },
                ],
              },
            ],
      },
    });

    if (conflictingSessions.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete availability slot with scheduled sessions',
          conflictingSessions: conflictingSessions.length,
        },
        { status: 409 }
      );
    }

    await prisma.coachAvailability.delete({
      where: { id: availabilityId },
    });

    return NextResponse.json({
      success: true,
      message: 'Availability slot deleted successfully',
    });
  } catch (error) {
    console.error('Delete availability error:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete availability' },
      { status: 500 }
    );
  }
}
