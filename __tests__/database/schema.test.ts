/**
 * Schema Integrity Test Suite
 *
 * Validates database schema constraints including:
 * - Cascade delete behavior
 * - SetNull constraint behavior
 * - Restrict constraint enforcement
 * - Performance index existence
 * - Referential integrity
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

jest.mock('@/lib/prisma', () => {
  const { testPrisma } = require('../setup/test-database');
  return { prisma: testPrisma };
});

import { testPrisma, setupTestDatabase, teardownTestDatabase, createTestParent, createTestStudent, createTestCoach, createTestSessionBooking, canConnectToTestDb } from '../setup/test-database';

const prisma = testPrisma;

describe('Schema Integrity Tests', () => {
  let dbAvailable = false;

  beforeAll(async () => {
    dbAvailable = await canConnectToTestDb();
    if (!dbAvailable) {
      console.warn('⚠️  Skipping schema integrity tests: test database not available');
    }
  }, 10000);

  beforeEach(async () => {
    if (!dbAvailable) return;
    await setupTestDatabase();
  }, 30000);

  afterAll(async () => {
    await teardownTestDatabase(dbAvailable);
  }, 30000);

  describe('Hermetic database reset', () => {
    it('makes a Jest lane fail when its afterAll database cleanup rejects', () => {
      const jestBin = path.resolve(process.cwd(), 'node_modules/jest/bin/jest.js');
      const config = JSON.stringify({
        rootDir: process.cwd(),
        testEnvironment: 'node',
        testMatch: ['<rootDir>/scripts/testing/fixtures/fatal-db-suite-cleanup.test.cjs'],
        transform: {},
      });
      const env = { ...process.env };
      delete env.DB_TEST_ORDER;
      delete env.DB_TEST_SEED;
      const result = spawnSync(
        process.execPath,
        [jestBin, '--runInBand', '--ci', '--no-cache', '--config', config],
        { cwd: process.cwd(), env, encoding: 'utf8' }
      );
      const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;

      expect(result.status).not.toBe(0);
      expect(output).toContain('FORCED_AFTER_ALL_DATABASE_CLEANUP_FAILURE');
      expect(output).toContain('Test Suites: 1 failed, 1 total');
    });

    it('never disables PostgreSQL replication triggers', () => {
      const helperSources = [
        path.resolve(process.cwd(), '__tests__/setup/test-database.ts'),
        path.resolve(process.cwd(), '__tests__/setup.ts'),
      ].map((file) => fs.readFileSync(file, 'utf8'));

      for (const source of helperSources) {
        expect(source).not.toMatch(/SET\s+session_replication_role\s*=\s*replica/i);
      }
    });

    it('uses one controlled truncate and preserves Prisma migration history', async () => {
      if (!dbAvailable) return;

      const before = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations"
      `;
      const executeSpy = jest.spyOn(prisma, '$executeRawUnsafe');
      let truncateStatements: string[] = [];

      try {
        await setupTestDatabase();
        truncateStatements = executeSpy.mock.calls
          .map(([statement]) => String(statement))
          .filter((statement) => /^TRUNCATE\s+TABLE\b/i.test(statement));
      } finally {
        executeSpy.mockRestore();
      }

      const after = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations"
      `;

      expect(before[0]?.count).toBeGreaterThan(0n);
      expect(after[0]?.count).toBe(before[0]?.count);
      expect(truncateStatements).toHaveLength(1);
      expect(truncateStatements[0]).toMatch(/RESTART\s+IDENTITY\s+CASCADE/i);
      expect(truncateStatements[0]).not.toContain('_prisma_migrations');
    });

    it('propagates controlled truncate failures', async () => {
      if (!dbAvailable) return;

      const executeSpy = jest
        .spyOn(prisma, '$executeRawUnsafe')
        .mockRejectedValueOnce(new Error('forced reset failure'));

      try {
        await expect(setupTestDatabase()).rejects.toThrow('forced reset failure');
      } finally {
        executeSpy.mockRestore();
      }
    });

    it('keeps every concurrently occupied database session in origin mode', async () => {
      if (!dbAvailable) return;

      await setupTestDatabase();
      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          prisma.$queryRawUnsafe<Array<{ backendPid: number; replicationRole: string }>>(`
            SELECT
              pg_backend_pid() AS "backendPid",
              current_setting('session_replication_role') AS "replicationRole"
            FROM (SELECT pg_sleep(0.1)) AS occupied
          `)
        )
      );
      const sessions = results.flat();

      expect(new Set(sessions.map(({ backendPid }) => backendPid)).size).toBeGreaterThan(1);
      expect(sessions.every(({ replicationRole }) => replicationRole === 'origin')).toBe(true);
    });
  });

  describe('Cascade Delete Tests', () => {
    describe('User → ParentProfile cascade', () => {
      it('should cascade delete ParentProfile when User is deleted', async () => {
        if (!dbAvailable) return;
        const { parentUser, parentProfile } = await createTestParent();

        const profileExists = await prisma.parentProfile.findUnique({
          where: { id: parentProfile.id }
        });
        expect(profileExists).toBeDefined();

        await prisma.user.delete({ where: { id: parentUser.id } });

        const profileAfterDelete = await prisma.parentProfile.findUnique({
          where: { id: parentProfile.id }
        });
        expect(profileAfterDelete).toBeNull();
      });
    });

    describe('User → Student cascade', () => {
      it('should cascade delete Student when User is deleted', async () => {
        if (!dbAvailable) return;
        const { parentProfile } = await createTestParent();
        const { studentUser, student } = await createTestStudent(parentProfile.id);

        const studentExists = await prisma.student.findUnique({
          where: { id: student.id }
        });
        expect(studentExists).toBeDefined();

        await prisma.user.delete({ where: { id: studentUser.id } });

        const studentAfterDelete = await prisma.student.findUnique({
          where: { id: student.id }
        });
        expect(studentAfterDelete).toBeNull();
      });
    });

    describe('User → CoachProfile cascade', () => {
      it('should cascade delete CoachProfile when User is deleted', async () => {
        if (!dbAvailable) return;
        const { coachUser, coachProfile } = await createTestCoach();

        const profileExists = await prisma.coachProfile.findUnique({
          where: { id: coachProfile.id }
        });
        expect(profileExists).toBeDefined();

        await prisma.user.delete({ where: { id: coachUser.id } });

        const profileAfterDelete = await prisma.coachProfile.findUnique({
          where: { id: coachProfile.id }
        });
        expect(profileAfterDelete).toBeNull();
      });
    });

    describe('Student → Subscription cascade', () => {
      it('should cascade delete Subscription when Student is deleted', async () => {
        if (!dbAvailable) return;
        const { parentProfile } = await createTestParent();
        const { student } = await createTestStudent(parentProfile.id);

        const subscription = await prisma.subscription.create({
          data: {
            studentId: student.id,
            planName: 'PREMIUM',
            status: 'ACTIVE',
            creditsPerMonth: 20,
            monthlyPrice: 199,
            startDate: new Date()
          }
        });

        await prisma.student.delete({ where: { id: student.id } });

        const subscriptionAfterDelete = await prisma.subscription.findUnique({
          where: { id: subscription.id }
        });
        expect(subscriptionAfterDelete).toBeNull();
      });
    });

    describe('Student → CreditTransaction cascade', () => {
      it('should cascade delete CreditTransaction when Student is deleted', async () => {
        if (!dbAvailable) return;
        const { parentProfile } = await createTestParent();
        const { student } = await createTestStudent(parentProfile.id);

        const transaction = await prisma.creditTransaction.create({
          data: {
            studentId: student.id,
            type: 'PURCHASE',
            amount: 10,
            description: 'Test credit purchase'
          }
        });

        await prisma.student.delete({ where: { id: student.id } });

        const transactionAfterDelete = await prisma.creditTransaction.findUnique({
          where: { id: transaction.id }
        });
        expect(transactionAfterDelete).toBeNull();
      });
    });

    describe('Student → Session cascade', () => {
      it('should cascade delete Session when Student is deleted', async () => {
        if (!dbAvailable) return;
        const { parentProfile } = await createTestParent();
        const { student } = await createTestStudent(parentProfile.id);
        const { coachProfile } = await createTestCoach();

        const session = await prisma.session.create({
          data: {
            studentId: student.id,
            coachId: coachProfile.id,
            type: 'COURS_ONLINE',
            subject: 'MATHEMATIQUES',
            title: 'Test Session',
            scheduledAt: new Date('2026-03-15T14:00:00Z'),
            duration: 60,
            creditCost: 1,
            status: 'SCHEDULED'
          }
        });

        await prisma.student.delete({ where: { id: student.id } });

        const sessionAfterDelete = await prisma.session.findUnique({
          where: { id: session.id }
        });
        expect(sessionAfterDelete).toBeNull();
      });
    });

    describe('Student → AriaConversation cascade', () => {
      it('should cascade delete AriaConversation when Student is deleted', async () => {
        if (!dbAvailable) return;
        const { parentProfile } = await createTestParent();
        const { student } = await createTestStudent(parentProfile.id);

        const conversation = await prisma.ariaConversation.create({
          data: {
            studentId: student.id,
            subject: 'MATHEMATIQUES',
            title: 'Test Conversation'
          }
        });

        await prisma.student.delete({ where: { id: student.id } });

        const conversationAfterDelete = await prisma.ariaConversation.findUnique({
          where: { id: conversation.id }
        });
        expect(conversationAfterDelete).toBeNull();
      });
    });

    describe('SessionBooking → SessionNotification cascade', () => {
      it('should cascade delete SessionNotification when SessionBooking is deleted', async () => {
        if (!dbAvailable) return;
        const sessionBooking = await createTestSessionBooking();

        const notification = await prisma.sessionNotification.create({
          data: {
            sessionId: sessionBooking.id,
            userId: sessionBooking.studentId,
            type: 'SESSION_BOOKED',
            title: 'Session Booked',
            message: 'Your session has been booked',
            method: 'EMAIL'
          }
        });

        await prisma.sessionBooking.delete({ where: { id: sessionBooking.id } });

        const notificationAfterDelete = await prisma.sessionNotification.findUnique({
          where: { id: notification.id }
        });
        expect(notificationAfterDelete).toBeNull();
      });
    });

    describe('SessionBooking → SessionReminder cascade', () => {
      it('should cascade delete SessionReminder when SessionBooking is deleted', async () => {
        if (!dbAvailable) return;
        const sessionBooking = await createTestSessionBooking();

        const reminder = await prisma.sessionReminder.create({
          data: {
            sessionId: sessionBooking.id,
            reminderType: 'ONE_DAY_BEFORE',
            scheduledFor: new Date('2026-03-14T14:00:00Z')
          }
        });

        await prisma.sessionBooking.delete({ where: { id: sessionBooking.id } });

        const reminderAfterDelete = await prisma.sessionReminder.findUnique({
          where: { id: reminder.id }
        });
        expect(reminderAfterDelete).toBeNull();
      });
    });
  });

  describe('SetNull Behavior Tests', () => {
    describe('CoachProfile → Session.coachId SetNull', () => {
      it('should set Session.coachId to null when CoachProfile is deleted', async () => {
        if (!dbAvailable) return;
        const { parentProfile } = await createTestParent();
        const { student } = await createTestStudent(parentProfile.id);
        const { coachProfile } = await createTestCoach();

        const session = await prisma.session.create({
          data: {
            studentId: student.id,
            coachId: coachProfile.id,
            type: 'COURS_ONLINE',
            subject: 'MATHEMATIQUES',
            title: 'Test Session',
            scheduledAt: new Date('2026-03-15T14:00:00Z'),
            duration: 60,
            creditCost: 1,
            status: 'SCHEDULED'
          }
        });

        expect(session.coachId).toBe(coachProfile.id);

        await prisma.coachProfile.delete({ where: { id: coachProfile.id } });

        const sessionAfterDelete = await prisma.session.findUnique({
          where: { id: session.id }
        });
        expect(sessionAfterDelete).toBeDefined();
        expect(sessionAfterDelete?.coachId).toBeNull();
      });
    });

    describe('User → Message.senderId SetNull', () => {
      it('should set Message.senderId to null when sender User is deleted', async () => {
        if (!dbAvailable) return;
        const { parentUser } = await createTestParent();
        const { coachUser } = await createTestCoach();

        const message = await prisma.message.create({
          data: {
            senderId: parentUser.id,
            receiverId: coachUser.id,
            content: 'Test message'
          }
        });

        expect(message.senderId).toBe(parentUser.id);

        await prisma.user.delete({ where: { id: parentUser.id } });

        const messageAfterDelete = await prisma.message.findUnique({
          where: { id: message.id }
        });
        expect(messageAfterDelete).toBeDefined();
        expect(messageAfterDelete?.senderId).toBeNull();
        expect(messageAfterDelete?.receiverId).toBe(coachUser.id);
      });
    });

    describe('User → Message.receiverId SetNull', () => {
      it('should set Message.receiverId to null when receiver User is deleted', async () => {
        if (!dbAvailable) return;
        const { parentUser } = await createTestParent();
        const { coachUser } = await createTestCoach();

        const message = await prisma.message.create({
          data: {
            senderId: parentUser.id,
            receiverId: coachUser.id,
            content: 'Test message'
          }
        });

        expect(message.receiverId).toBe(coachUser.id);

        await prisma.user.delete({ where: { id: coachUser.id } });

        const messageAfterDelete = await prisma.message.findUnique({
          where: { id: message.id }
        });
        expect(messageAfterDelete).toBeDefined();
        expect(messageAfterDelete?.senderId).toBe(parentUser.id);
        expect(messageAfterDelete?.receiverId).toBeNull();
      });
    });

    describe('CoachProfile → StudentReport.coachId SetNull', () => {
      it('should set StudentReport.coachId to null when CoachProfile is deleted', async () => {
        if (!dbAvailable) return;
        const { parentProfile } = await createTestParent();
        const { student } = await createTestStudent(parentProfile.id);
        const { coachProfile } = await createTestCoach();

        const report = await prisma.studentReport.create({
          data: {
            studentId: student.id,
            coachId: coachProfile.id,
            title: 'Progress Report',
            content: 'Student is doing well',
            period: 'Week 1',
            sessionsCount: 5
          }
        });

        expect(report.coachId).toBe(coachProfile.id);

        await prisma.coachProfile.delete({ where: { id: coachProfile.id } });

        const reportAfterDelete = await prisma.studentReport.findUnique({
          where: { id: report.id }
        });
        expect(reportAfterDelete).toBeDefined();
        expect(reportAfterDelete?.coachId).toBeNull();
      });
    });
  });

  describe('Cascade Behavior Tests (formerly Restrict)', () => {
    describe('User with Payment → SetNull', () => {
      it('should set Payment.userId to null when User is deleted (preserves payment history)', async () => {
        if (!dbAvailable) return;
        const { parentUser } = await createTestParent();

        const payment = await prisma.payment.create({
          data: {
            userId: parentUser.id,
            type: 'CREDIT_PACK',
            amount: 99.99,
            description: 'Credit pack purchase',
            status: 'COMPLETED',
            method: 'clictopay'
          }
        });

        expect(payment).toBeDefined();

        // Payment.userId uses onDelete: SetNull — payment persists with userId=null
        await prisma.user.delete({ where: { id: parentUser.id } });

        const paymentAfterDelete = await prisma.payment.findUnique({
          where: { id: payment.id }
        });
        expect(paymentAfterDelete).not.toBeNull();
        expect(paymentAfterDelete!.userId).toBeNull();
      });
    });

    describe('Badge awarded to students → Cascade', () => {
      it('should cascade delete StudentBadge when Badge is deleted', async () => {
        if (!dbAvailable) return;
        const { parentProfile } = await createTestParent();
        const { student } = await createTestStudent(parentProfile.id);

        const badge = await prisma.badge.create({
          data: {
            name: 'First Session',
            description: 'Completed your first session',
            category: 'ASSIDUITE',
            condition: 'Complete 1 session'
          }
        });

        await prisma.studentBadge.create({
          data: {
            studentId: student.id,
            badgeId: badge.id
          }
        });

        // StudentBadge.badgeId is now CASCADE - deletion should succeed
        await prisma.badge.delete({ where: { id: badge.id } });

        const badgeAfterDelete = await prisma.badge.findUnique({
          where: { id: badge.id }
        });
        expect(badgeAfterDelete).toBeNull();
      });
    });
  });

  describe('Index Existence Tests', () => {
    it('should have index on User.role', async () => {
        if (!dbAvailable) return;
      const result = await prisma.$queryRaw<any[]>`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'users' AND indexdef LIKE '%role%'
      `;
      expect(result.length).toBeGreaterThan(0);
    });

    it('should have index on Session.studentId', async () => {
        if (!dbAvailable) return;
      const result = await prisma.$queryRaw<any[]>`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'sessions' AND indexdef LIKE '%studentId%'
      `;
      expect(result.length).toBeGreaterThan(0);
    });

    it('should have index on Session.coachId', async () => {
        if (!dbAvailable) return;
      const result = await prisma.$queryRaw<any[]>`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'sessions' AND indexdef LIKE '%coachId%'
      `;
      expect(result.length).toBeGreaterThan(0);
    });

    it('should have index on Session.status', async () => {
        if (!dbAvailable) return;
      const result = await prisma.$queryRaw<any[]>`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'sessions' AND indexdef LIKE '%status%'
      `;
      expect(result.length).toBeGreaterThan(0);
    });

    it('should have composite index on AriaConversation(studentId, updatedAt)', async () => {
        if (!dbAvailable) return;
      const result = await prisma.$queryRaw<any[]>`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'aria_conversations' 
        AND indexdef LIKE '%studentId%' 
        AND indexdef LIKE '%updatedAt%'
      `;
      expect(result.length).toBeGreaterThan(0);
    });

    it('should have composite index on AriaMessage(conversationId, createdAt)', async () => {
        if (!dbAvailable) return;
      const result = await prisma.$queryRaw<any[]>`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'aria_messages' 
        AND indexdef LIKE '%conversationId%' 
        AND indexdef LIKE '%createdAt%'
      `;
      expect(result.length).toBeGreaterThan(0);
    });

    it('should have composite index on Notification(userId, read)', async () => {
        if (!dbAvailable) return;
      const result = await prisma.$queryRaw<any[]>`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'notifications' 
        AND indexdef LIKE '%userId%' 
        AND indexdef LIKE '%read%'
      `;
      expect(result.length).toBeGreaterThan(0);
    });

    it('should have index on Notification.userRole', async () => {
        if (!dbAvailable) return;
      const result = await prisma.$queryRaw<any[]>`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'notifications' AND indexdef LIKE '%userRole%'
      `;
      expect(result.length).toBeGreaterThan(0);
    });

    it('should have composite index on CreditTransaction(studentId, createdAt)', async () => {
        if (!dbAvailable) return;
      const result = await prisma.$queryRaw<any[]>`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'credit_transactions' 
        AND indexdef LIKE '%studentId%' 
        AND indexdef LIKE '%createdAt%'
      `;
      expect(result.length).toBeGreaterThan(0);
    });

    it('should have index on CreditTransaction.sessionId', async () => {
        if (!dbAvailable) return;
      const result = await prisma.$queryRaw<any[]>`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'credit_transactions' AND indexdef LIKE '%sessionId%'
      `;
      expect(result.length).toBeGreaterThan(0);
    });

    it('should have composite index on Subscription(studentId, status)', async () => {
        if (!dbAvailable) return;
      const result = await prisma.$queryRaw<any[]>`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'subscriptions' 
        AND indexdef LIKE '%studentId%' 
        AND indexdef LIKE '%status%'
      `;
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Constraint Enforcement Tests', () => {
    describe('Unique Constraints', () => {
      it('should enforce unique email constraint on User', async () => {
        if (!dbAvailable) return;
        const email = `unique.test.${Date.now()}@test.com`;
        
        await prisma.user.create({
          data: {
            email,
            role: 'PARENT',
            firstName: 'John',
            lastName: 'Doe'
          }
        });

        await expect(
          prisma.user.create({
            data: {
              email,
              role: 'PARENT',
              firstName: 'Jane',
              lastName: 'Doe'
            }
          })
        ).rejects.toThrow();
      });

      it('should enforce unique pseudonym constraint on CoachProfile', async () => {
        if (!dbAvailable) return;
        const pseudonym = `TestCoach_${Date.now()}`;
        
        const { coachUser: coach1 } = await createTestCoach({
          profile: { pseudonym }
        });

        const coach2User = await prisma.user.create({
          data: {
            email: `coach2.${Date.now()}@test.com`,
            role: 'COACH',
            firstName: 'Coach',
            lastName: 'Two'
          }
        });

        await expect(
          prisma.coachProfile.create({
            data: {
              userId: coach2User.id,
              pseudonym,
              subjects: JSON.stringify(['MATHEMATIQUES']),
              availableOnline: true
            }
          })
        ).rejects.toThrow();
      });

      it('should enforce unique (studentId, badgeId) constraint on StudentBadge', async () => {
        if (!dbAvailable) return;
        const { parentProfile } = await createTestParent();
        const { student } = await createTestStudent(parentProfile.id);

        const badge = await prisma.badge.create({
          data: {
            name: `TestBadge_${Date.now()}`,
            description: 'Test badge',
            category: 'ASSIDUITE',
            condition: 'Test condition'
          }
        });

        await prisma.studentBadge.create({
          data: {
            studentId: student.id,
            badgeId: badge.id
          }
        });

        await expect(
          prisma.studentBadge.create({
            data: {
              studentId: student.id,
              badgeId: badge.id
            }
          })
        ).rejects.toThrow();
      });
    });

    describe('Session Overlap Prevention', () => {
      it('should prevent overlapping session bookings for same coach', async () => {
        if (!dbAvailable) return;
        const { coachUser } = await createTestCoach();
        const { parentProfile } = await createTestParent();
        const { studentUser } = await createTestStudent(parentProfile.id);

        // Use a unique future date to avoid collisions with other test data
        const uniqueDate = new Date();
        uniqueDate.setDate(uniqueDate.getDate() + 30 + Math.floor(Math.random() * 300));
        uniqueDate.setHours(0, 0, 0, 0);

        const baseData = {
          coachId: coachUser.id,
          studentId: studentUser.id,
          subject: 'MATHEMATIQUES' as const,
          title: 'Test Session',
          scheduledDate: uniqueDate,
          type: 'INDIVIDUAL' as const,
          modality: 'ONLINE' as const,
          creditsUsed: 1,
          status: 'SCHEDULED' as const
        };

        await prisma.sessionBooking.create({
          data: {
            ...baseData,
            startTime: '14:00',
            endTime: '15:00',
            duration: 60
          }
        });

        await expect(
          prisma.sessionBooking.create({
            data: {
              ...baseData,
              startTime: '14:30',
              endTime: '15:30',
              duration: 60
            }
          })
        ).rejects.toThrow();
      });
    });

    describe('Payment Idempotency', () => {
      it('should prevent duplicate payments with same externalId and method', async () => {
        if (!dbAvailable) return;
        const { parentUser } = await createTestParent();
        const externalId = `test_payment_${Date.now()}`;

        await prisma.payment.create({
          data: {
            userId: parentUser.id,
            type: 'CREDIT_PACK',
            amount: 99.99,
            description: 'Test payment',
            status: 'COMPLETED',
            method: 'clictopay',
            externalId
          }
        });

        await expect(
          prisma.payment.create({
            data: {
              userId: parentUser.id,
              type: 'CREDIT_PACK',
              amount: 99.99,
              description: 'Duplicate payment',
              status: 'COMPLETED',
              method: 'clictopay',
              externalId
            }
          })
        ).rejects.toThrow();
      });
    });
  });
});
