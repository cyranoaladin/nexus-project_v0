/**
 * Concurrency Test - Double Booking Prevention
 *
 * Verifies that the database exclusion constraint and Serializable isolation
 * prevent overlapping session bookings when multiple requests are made concurrently.
 *
 * Invariants tested:
 * - INV-SES-1: No exact duplicate bookings
 * - INV-SES-2: No overlapping sessions for same coach/date
 */

// Mock lib/prisma to use testPrisma for concurrency tests
jest.mock('@/lib/prisma', () => {
  const { testPrisma } = require('../setup/test-database');
  return { prisma: testPrisma };
});

import { PrismaClient } from '@prisma/client';
import { testPrisma, setupTestDatabase, createTestCoach, createTestStudent, createTestParent } from '../setup/test-database';

const prisma = testPrisma;

describe('Double Booking Prevention - Concurrency', () => {
  let coachId: string;
  let studentId: string;
  let parentId: string;

  beforeAll(async () => {
    await setupTestDatabase();

    // Create test users
    const { parentProfile } = await createTestParent({ email: 'parent.booking@test.com' });
    parentId = parentProfile.id;

    const { coachUser } = await createTestCoach({ user: { email: 'coach.booking@test.com' } });
    coachId = coachUser.id;

    const { studentUser } = await createTestStudent(parentProfile.id, { user: { email: 'student.booking@test.com' } });
    studentId = studentUser.id;
  });

  afterAll(async () => {
    await setupTestDatabase();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Clean up session bookings after each test
    await prisma.sessionBooking.deleteMany({});
  });

  describe('Exact Duplicate Prevention', () => {
    it('should prevent exact duplicate bookings made concurrently', async () => {
      const bookingData = {
        coachId,
        studentId,
        subject: 'MATHEMATIQUES' as const,
        title: 'Math Session',
        scheduledDate: new Date('2026-03-15'),
        startTime: '14:00',
        endTime: '15:00',
        duration: 60,
        type: 'INDIVIDUAL' as const,
        modality: 'ONLINE' as const,
        creditsUsed: 1,
        status: 'SCHEDULED' as const
      };

      // Make two concurrent identical booking requests
      const results = await Promise.allSettled([
        prisma.sessionBooking.create({ data: bookingData }),
        prisma.sessionBooking.create({ data: bookingData })
      ]);

      // Exactly one should succeed
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      // Verify only one booking exists in database
      const bookings = await prisma.sessionBooking.findMany({
        where: { coachId, scheduledDate: new Date('2026-03-15') }
      });
      expect(bookings).toHaveLength(1);
    });
  });

  describe('Overlapping Time Slots Prevention', () => {
    it('should prevent overlapping bookings for same coach/date', async () => {
      // First booking: 14:00-15:00
      const firstBooking = await prisma.sessionBooking.create({
        data: {
          coachId,
          studentId,
          subject: 'MATHEMATIQUES',
          title: 'First Session',
          scheduledDate: new Date('2026-03-16'),
          startTime: '14:00',
          endTime: '15:00',
          duration: 60,
          type: 'INDIVIDUAL',
          modality: 'ONLINE',
          creditsUsed: 1,
          status: 'SCHEDULED'
        }
      });
      expect(firstBooking).toBeDefined();

      // Try to create overlapping booking: 14:30-15:30
      await expect(
        prisma.sessionBooking.create({
          data: {
            coachId,
            studentId,
            subject: 'MATHEMATIQUES',
            title: 'Overlapping Session',
            scheduledDate: new Date('2026-03-16'),
            startTime: '14:30',
            endTime: '15:30',
            duration: 60,
            type: 'INDIVIDUAL',
            modality: 'ONLINE',
            creditsUsed: 1,
            status: 'SCHEDULED'
          }
        })
      ).rejects.toThrow();

      // Verify only first booking exists
      const bookings = await prisma.sessionBooking.findMany({
        where: { coachId, scheduledDate: new Date('2026-03-16') }
      });
      expect(bookings).toHaveLength(1);
      expect(bookings[0].startTime).toBe('14:00');
    });

    it('should prevent booking that completely contains existing session', async () => {
      // First booking: 14:00-15:00
      await prisma.sessionBooking.create({
        data: {
          coachId,
          studentId,
          subject: 'MATHEMATIQUES',
          title: 'Contained Session',
          scheduledDate: new Date('2026-03-17'),
          startTime: '14:00',
          endTime: '15:00',
          duration: 60,
          type: 'INDIVIDUAL',
          modality: 'ONLINE',
          creditsUsed: 1,
          status: 'SCHEDULED'
        }
      });

      // Try to create booking that contains it: 13:00-16:00
      await expect(
        prisma.sessionBooking.create({
          data: {
            coachId,
            studentId,
            subject: 'MATHEMATIQUES',
            title: 'Containing Session',
            scheduledDate: new Date('2026-03-17'),
            startTime: '13:00',
            endTime: '16:00',
            duration: 180,
            type: 'INDIVIDUAL',
            modality: 'ONLINE',
            creditsUsed: 3,
            status: 'SCHEDULED'
          }
        })
      ).rejects.toThrow();
    });

    it('should allow non-overlapping sessions on same date', async () => {
      // First booking: 14:00-15:00
      const first = await prisma.sessionBooking.create({
        data: {
          coachId,
          studentId,
          subject: 'MATHEMATIQUES',
          title: 'Morning Session',
          scheduledDate: new Date('2026-03-18'),
          startTime: '14:00',
          endTime: '15:00',
          duration: 60,
          type: 'INDIVIDUAL',
          modality: 'ONLINE',
          creditsUsed: 1,
          status: 'SCHEDULED'
        }
      });

      // Non-overlapping booking: 16:00-17:00
      const second = await prisma.sessionBooking.create({
        data: {
          coachId,
          studentId,
          subject: 'PHYSIQUE_CHIMIE',
          title: 'Afternoon Session',
          scheduledDate: new Date('2026-03-18'),
          startTime: '16:00',
          endTime: '17:00',
          duration: 60,
          type: 'INDIVIDUAL',
          modality: 'ONLINE',
          creditsUsed: 1,
          status: 'SCHEDULED'
        }
      });

      expect(first.id).toBeDefined();
      expect(second.id).toBeDefined();
      expect(first.id).not.toBe(second.id);
    });

    it('should allow overlapping bookings for cancelled sessions', async () => {
      // First booking: CANCELLED status
      await prisma.sessionBooking.create({
        data: {
          coachId,
          studentId,
          subject: 'MATHEMATIQUES',
          title: 'Cancelled Session',
          scheduledDate: new Date('2026-03-19'),
          startTime: '14:00',
          endTime: '15:00',
          duration: 60,
          type: 'INDIVIDUAL',
          modality: 'ONLINE',
          creditsUsed: 1,
          status: 'CANCELLED'  // Not an active status
        }
      });

      // Overlapping booking with SCHEDULED status should be allowed
      const second = await prisma.sessionBooking.create({
        data: {
          coachId,
          studentId,
          subject: 'MATHEMATIQUES',
          title: 'New Session',
          scheduledDate: new Date('2026-03-19'),
          startTime: '14:00',
          endTime: '15:00',
          duration: 60,
          type: 'INDIVIDUAL',
          modality: 'ONLINE',
          creditsUsed: 1,
          status: 'SCHEDULED'
        }
      });

      expect(second).toBeDefined();
    });
  });

  describe('Concurrent Overlapping Requests', () => {
    it('should handle concurrent overlapping booking attempts', async () => {
      const baseData = {
        coachId,
        studentId,
        subject: 'MATHEMATIQUES' as const,
        scheduledDate: new Date('2026-03-20'),
        type: 'INDIVIDUAL' as const,
        modality: 'ONLINE' as const,
        creditsUsed: 1,
        status: 'SCHEDULED' as const
      };

      // Make 3 concurrent overlapping booking requests
      const results = await Promise.allSettled([
        prisma.sessionBooking.create({
          data: { ...baseData, title: 'Slot 1', startTime: '14:00', endTime: '15:00', duration: 60 }
        }),
        prisma.sessionBooking.create({
          data: { ...baseData, title: 'Slot 2', startTime: '14:30', endTime: '15:30', duration: 60 }
        }),
        prisma.sessionBooking.create({
          data: { ...baseData, title: 'Slot 3', startTime: '14:15', endTime: '15:15', duration: 60 }
        })
      ]);

      // At most one should succeed (might be 0 if all conflict)
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      expect(fulfilled.length).toBeLessThanOrEqual(1);

      // Verify database state
      const bookings = await prisma.sessionBooking.findMany({
        where: { coachId, scheduledDate: new Date('2026-03-20') }
      });
      expect(bookings.length).toBeLessThanOrEqual(1);
    });
  });
});
