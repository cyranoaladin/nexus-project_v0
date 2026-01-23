import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import type { CoachAvailability, Prisma } from '@prisma/client';

type AvailabilitySlot = Pick<
  CoachAvailability,
  'dayOfWeek' | 'startTime' | 'endTime' | 'isRecurring' | 'specificDate'
>;

type BookedSlot = {
  scheduledDate: Date;
  startTime: string;
  endTime: string;
  status: string;
};

function normalizeTime(time: string): string {
  const [h, m] = time.split(':').map((v) => parseInt(v, 10));
  const hh = String(isNaN(h) ? 0 : h).padStart(2, '0');
  const mm = String(isNaN(m) ? 0 : m).padStart(2, '0');
  return `${hh}:${mm}`;
}

// Validation schema for setting availability
const availabilitySchema = z.object({
  schedule: z.array(z.object({
    dayOfWeek: z.number().min(0).max(6), // 0 = Sunday, 6 = Saturday
    slots: z.array(z.object({
      startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
      endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
      isAvailable: z.boolean().default(true)
    }))
  })),
  validFrom: z.string().optional(),
  validUntil: z.string().optional()
});

// Validation schema for specific date availability
const specificDateSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  slots: z.array(z.object({
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
    isAvailable: z.boolean().default(true)
  }))
});

function isEndAfterStart(startTime: string, endTime: string): boolean {
  return startTime < endTime;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || session.user.role !== 'COACH') {
      return NextResponse.json(
        { error: 'Only coaches can set availability' },
        { status: 403 }
      );
    }

    const body = (await req.json()) as { type?: 'weekly' | 'specific' } & Record<string, unknown>;
    const { type, ...data } = body;

    if (type === 'weekly') {
      const validatedData = availabilitySchema.parse(data);

      // Validate slot times and deduplicate
      const uniqueKeys = new Set<string>();
      for (const day of validatedData.schedule) {
        for (const slot of day.slots) {
          if (!isEndAfterStart(slot.startTime, slot.endTime)) {
            return NextResponse.json(
              { error: `Invalid time range ${slot.startTime}-${slot.endTime} for day ${day.dayOfWeek}` },
              { status: 400 }
            );
          }
          const key = `${day.dayOfWeek}|${slot.startTime}|${slot.endTime}|weekly`;
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
          specificDate: { equals: null }
        }
      });

      // Create new availability slots
      const availabilitySlots: Prisma.CoachAvailabilityCreateManyInput[] = [];
      
      for (const day of validatedData.schedule) {
        for (const slot of day.slots) {
          availabilitySlots.push({
            coachId: session.user.id,
            dayOfWeek: day.dayOfWeek,
            startTime: normalizeTime(slot.startTime),
            endTime: normalizeTime(slot.endTime),
            isAvailable: slot.isAvailable,
            isRecurring: true,
            validFrom: validatedData.validFrom ? new Date(validatedData.validFrom) : new Date(),
            validUntil: validatedData.validUntil ? new Date(validatedData.validUntil) : null
          });
        }
      }

      if (availabilitySlots.length > 0) {
        try {
          await prisma.coachAvailability.createMany({ data: availabilitySlots });
        } catch (e: unknown) {
          const errorCode =
            typeof e === 'object' && e !== null && 'code' in e
              ? (e as { code?: string }).code
              : undefined;
          if (errorCode === 'P2002') {
            return NextResponse.json(
              { error: 'Some slots conflict with existing ones (unique constraint). Please adjust times.' },
              { status: 409 }
            );
          }
          throw e;
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Weekly availability updated successfully',
        slotsCreated: availabilitySlots.length
      });

    } else if (type === 'specific') {
      const validatedData = specificDateSchema.parse(data);
      
      const specificDate = new Date(validatedData.date);

      // Validate slot times and deduplicate for specific date
      const uniqueKeys = new Set<string>();
      for (const slot of validatedData.slots) {
        if (!isEndAfterStart(slot.startTime, slot.endTime)) {
          return NextResponse.json(
            { error: `Invalid time range ${slot.startTime}-${slot.endTime} for date ${validatedData.date}` },
            { status: 400 }
          );
        }
        const key = `${specificDate.toDateString()}|${slot.startTime}|${slot.endTime}|specific`;
        if (uniqueKeys.has(key)) {
          return NextResponse.json(
            { error: `Duplicate slot ${slot.startTime}-${slot.endTime} for date ${validatedData.date}` },
            { status: 400 }
          );
        }
        uniqueKeys.add(key);
      }
      
      // Clear existing availability for this specific date
      await prisma.coachAvailability.deleteMany({
        where: {
          coachId: session.user.id,
          specificDate: specificDate
        }
      });

      // Create new availability slots for specific date
      const availabilitySlots = validatedData.slots.map(slot => ({
        coachId: session.user.id,
        dayOfWeek: specificDate.getDay(),
        startTime: normalizeTime(slot.startTime),
        endTime: normalizeTime(slot.endTime),
        isAvailable: slot.isAvailable,
        isRecurring: false,
        specificDate: specificDate
      }));

      if (availabilitySlots.length > 0) {
        try {
          await prisma.coachAvailability.createMany({ data: availabilitySlots });
        } catch (e: unknown) {
          const errorCode =
            typeof e === 'object' && e !== null && 'code' in e
              ? (e as { code?: string }).code
              : undefined;
          if (errorCode === 'P2002') {
            return NextResponse.json(
              { error: 'Some slots conflict with existing ones (unique constraint). Please adjust times.' },
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
        slotsCreated: availabilitySlots.length
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
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const coachId = searchParams.get('coachId') || session.user.id;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Only coaches can view their own availability, others can view any coach's availability
    if (session.user.role === 'COACH' && coachId !== session.user.id) {
      return NextResponse.json(
        { error: 'You can only view your own availability' },
        { status: 403 }
      );
    }

    // Build query conditions
    const whereConditions: Prisma.CoachAvailabilityWhereInput = {
      coachId: coachId,
      isAvailable: true
    };

    if (startDate && endDate) {
      whereConditions.OR = [
        {
          // Recurring availability
          isRecurring: true,
          specificDate: { equals: null },
          validFrom: { lte: new Date(endDate) },
          OR: [
            { validUntil: null },
            { validUntil: { gte: new Date(startDate) } }
          ]
        },
        {
          // Specific date availability
          isRecurring: false,
          specificDate: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          }
        }
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
            email: true
          }
        }
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { startTime: 'asc' }
      ]
    });

    // Get existing bookings to check actual availability
    let bookedSlots: BookedSlot[] = [];
    if (startDate && endDate) {
      bookedSlots = await prisma.sessionBooking.findMany({
        where: {
          coachId: coachId,
          scheduledDate: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          },
          status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] }
        },
        select: {
          scheduledDate: true,
          startTime: true,
          endTime: true,
          status: true
        }
      });
    }

    // Generate available time slots for the requested period
    const availableSlots = generateAvailableSlots(availability, bookedSlots, startDate, endDate);

    return NextResponse.json({
      success: true,
      availability: availability,
      bookedSlots: bookedSlots,
      availableSlots: availableSlots,
      coach: availability[0]?.coach || null
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
  availability: AvailabilitySlot[],
  bookedSlots: BookedSlot[],
  startDate: string | null,
  endDate: string | null
) {
  if (!startDate || !endDate) return [];

  const slots: Array<{
    date: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    duration: number;
    isRecurring: boolean;
    specificDate: Date | null;
  }> = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Generate slots for each day in the range
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const dayOfWeek = date.getDay();
    
    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const dateStr = date.toISOString().split('T')[0];
    
    // Find availability for this day
    const dayAvailability = availability.filter(av => 
      (av.isRecurring && av.dayOfWeek === dayOfWeek) ||
      (!av.isRecurring && av.specificDate && new Date(av.specificDate).toDateString() === date.toDateString())
    );

    // Find bookings for this day
    const dayBookings = bookedSlots.filter(booking => 
      new Date(booking.scheduledDate).toDateString() === date.toDateString()
    );

    // Generate slots from availability
    for (const av of dayAvailability) {
      // Check if this slot conflicts with any booking
      const isBooked = dayBookings.some(booking => 
        booking.startTime < av.endTime && booking.endTime > av.startTime
      );

      if (!isBooked) {
        // Check if slot is within business hours (8 AM to 8 PM)
        const startHour = parseInt(av.startTime.split(':')[0]);
        const endHour = parseInt(av.endTime.split(':')[0]);
        
        if (startHour >= 8 && endHour <= 20) {
          slots.push({
            date: dateStr,
            dayOfWeek: dayOfWeek,
            startTime: av.startTime,
            endTime: av.endTime,
            duration: calculateDuration(av.startTime, av.endTime),
            isRecurring: av.isRecurring,
            specificDate: av.specificDate
          });
        }
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
  return (endHour * 60 + endMin) - (startHour * 60 + startMin);
}

// DELETE - Remove specific availability slot
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || session.user.role !== 'COACH') {
      return NextResponse.json(
        { error: 'Only coaches can delete availability' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const availabilityId = searchParams.get('id');

    if (!availabilityId) {
      return NextResponse.json(
        { error: 'Availability ID is required' },
        { status: 400 }
      );
    }

    // Verify the availability belongs to the coach
    const availability = await prisma.coachAvailability.findFirst({
      where: {
        id: availabilityId,
        coachId: session.user.id
      }
    });

    if (!availability) {
      return NextResponse.json(
        { error: 'Availability slot not found' },
        { status: 404 }
      );
    }

    // Check if there are any scheduled sessions during this time
    const conflictingSessions = await prisma.sessionBooking.findMany({
      where: {
        coachId: session.user.id,
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        OR: availability.specificDate ? [
          { scheduledDate: availability.specificDate }
        ] : [
          {
            AND: [
              { startTime: { gte: availability.startTime } },
              { endTime: { lte: availability.endTime } }
            ]
          }
        ]
      }
    });

    if (conflictingSessions.length > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete availability slot with scheduled sessions',
          conflictingSessions: conflictingSessions.length
        },
        { status: 409 }
      );
    }

    await prisma.coachAvailability.delete({
      where: { id: availabilityId }
    });

    return NextResponse.json({
      success: true,
      message: 'Availability slot deleted successfully'
    });

  } catch (error) {
    console.error('Delete availability error:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete availability' },
      { status: 500 }
    );
  }
} 
