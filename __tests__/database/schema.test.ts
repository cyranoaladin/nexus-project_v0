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

jest.mock('@/lib/prisma', () => {
  const { testPrisma } = require('../setup/test-database');
  return { prisma: testPrisma };
});

import { testPrisma, setupTestDatabase, createTestParent, createTestStudent, createTestCoach, createTestSessionBooking } from '../setup/test-database';

const prisma = testPrisma;

describe.skip('Schema Integrity Tests', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await setupTestDatabase();
    await prisma.$disconnect();
  });

  describe('Cascade Delete Tests', () => {
    describe('User → ParentProfile cascade', () => {
      it('should cascade delete ParentProfile when User is deleted', async () => {
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

    describe('User → StudentProfile cascade', () => {
      it('should cascade delete StudentProfile when User is deleted', async () => {
        const { parentProfile } = await createTestParent();
        const { studentUser, studentProfile } = await createTestStudent(parentProfile.id);

        const profileExists = await prisma.studentProfile.findUnique({
          where: { id: studentProfile.id }
        });
        expect(profileExists).toBeDefined();

        await prisma.user.delete({ where: { id: studentUser.id } });

        const profileAfterDelete = await prisma.studentProfile.findUnique({
          where: { id: studentProfile.id }
        });
        expect(profileAfterDelete).toBeNull();
      });
    });

    describe('User → CoachProfile cascade', () => {
      it('should cascade delete CoachProfile when User is deleted', async () => {
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

  describe('Restrict Behavior Tests', () => {
    describe('User with Payment → Restrict', () => {
      it('should prevent deletion of User with Payment history', async () => {
        const { parentUser } = await createTestParent();

        const payment = await prisma.payment.create({
          data: {
            userId: parentUser.id,
            type: 'CREDIT_PACK',
            amount: 99.99,
            description: 'Credit pack purchase',
            status: 'COMPLETED',
            method: 'konnect'
          }
        });

        expect(payment).toBeDefined();

        await expect(
          prisma.user.delete({ where: { id: parentUser.id } })
        ).rejects.toThrow();

        const userAfterFailedDelete = await prisma.user.findUnique({
          where: { id: parentUser.id }
        });
        expect(userAfterFailedDelete).toBeDefined();
      });
    });

    describe('Badge awarded to students → Restrict', () => {
      it('should prevent deletion of Badge if awarded to students', async () => {
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

        await expect(
          prisma.badge.delete({ where: { id: badge.id } })
        ).rejects.toThrow();

        const badgeAfterFailedDelete = await prisma.badge.findUnique({
          where: { id: badge.id }
        });
        expect(badgeAfterFailedDelete).toBeDefined();
      });
    });
  });

  describe('Index Existence Tests', () => {
    it('should have index on User.role', async () => {
      const result = await prisma.$queryRaw<any[]>`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'users' AND indexdef LIKE '%role%'
      `;
      expect(result.length).toBeGreaterThan(0);
    });

    it('should have index on Session.studentId', async () => {
      const result = await prisma.$queryRaw<any[]>`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'sessions' AND indexdef LIKE '%studentId%'
      `;
      expect(result.length).toBeGreaterThan(0);
    });

    it('should have index on Session.coachId', async () => {
      const result = await prisma.$queryRaw<any[]>`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'sessions' AND indexdef LIKE '%coachId%'
      `;
      expect(result.length).toBeGreaterThan(0);
    });

    it('should have index on Session.status', async () => {
      const result = await prisma.$queryRaw<any[]>`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'sessions' AND indexdef LIKE '%status%'
      `;
      expect(result.length).toBeGreaterThan(0);
    });

    it('should have composite index on AriaConversation(studentId, updatedAt)', async () => {
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
      const result = await prisma.$queryRaw<any[]>`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'notifications' AND indexdef LIKE '%userRole%'
      `;
      expect(result.length).toBeGreaterThan(0);
    });

    it('should have composite index on CreditTransaction(studentId, createdAt)', async () => {
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
      const result = await prisma.$queryRaw<any[]>`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'credit_transactions' AND indexdef LIKE '%sessionId%'
      `;
      expect(result.length).toBeGreaterThan(0);
    });

    it('should have composite index on Subscription(studentId, status)', async () => {
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
        const { coachUser } = await createTestCoach();
        const { parentProfile } = await createTestParent();
        const { studentUser } = await createTestStudent(parentProfile.id);

        const baseData = {
          coachId: coachUser.id,
          studentId: studentUser.id,
          subject: 'MATHEMATIQUES' as const,
          title: 'Test Session',
          scheduledDate: new Date('2026-03-15'),
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
        const { parentUser } = await createTestParent();
        const externalId = `test_payment_${Date.now()}`;

        await prisma.payment.create({
          data: {
            userId: parentUser.id,
            type: 'CREDIT_PACK',
            amount: 99.99,
            description: 'Test payment',
            status: 'COMPLETED',
            method: 'konnect',
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
              method: 'konnect',
              externalId
            }
          })
        ).rejects.toThrow();
      });
    });
  });
});
