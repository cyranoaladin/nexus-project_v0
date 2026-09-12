/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { prisma } from '@/lib/prisma';
import {
  ARIA_WORKSHOP_REMINDER_OFFSET_HOURS,
  queueDueAriaWorkshopReminders,
} from '@/lib/aria/application/workshop/queue-due-workshop-reminders';
import {
  cleanupAriaRealDbFixture,
  seedAriaRealDbFixture,
} from '@/__tests__/helpers/aria-real-db';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const REAL_COURSE_KEY = 'eds-maths-premiere';

// A workshop starting at 14:00 on 2026-10-10 (pseudo-UTC, same convention as
// combineDateAndTime) — its reminder is due exactly ARIA_WORKSHOP_REMINDER_OFFSET_HOURS
// (24h) before that, and every test below anchors its own `now` off this.
const SESSION_SCHEDULED_DATE = new Date('2026-10-10T00:00:00.000Z');
const SESSION_START_INSTANT = new Date('2026-10-10T14:00:00.000Z');
const REMINDER_DUE_AT = new Date(
  SESSION_START_INSTANT.getTime() - ARIA_WORKSHOP_REMINDER_OFFSET_HOURS * 60 * 60 * 1000,
);
const BEFORE_DUE = new Date(REMINDER_DUE_AT.getTime() - 60 * 1000);
const AFTER_SESSION_START = new Date(SESSION_START_INSTANT.getTime() + 60 * 1000);

async function upgradeToSuiviTier(pool: Pool, entitlementId: string): Promise<void> {
  await pool.query(`UPDATE entitlements SET "ariaTier" = 'ARIA_SUIVI' WHERE id = $1`, [entitlementId]);
}

async function createStaffUser(pool: Pool): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO users (id, email, role, "updatedAt") VALUES ($1, $2, 'ASSISTANTE', NOW())`,
    [id, `assistante-${id}@invalid.test`],
  );
  return id;
}

async function createSession(
  staffUserId: string,
  overrides: Partial<{ status: 'SCHEDULED' | 'CANCELLED' | 'COMPLETED'; title: string }> = {},
): Promise<string> {
  const session = await prisma.ariaWorkshopSession.create({
    data: {
      courseKey: REAL_COURSE_KEY,
      title: overrides.title ?? 'Atelier rappel P7c',
      scheduledDate: SESSION_SCHEDULED_DATE,
      startTime: '14:00',
      endTime: '15:00',
      status: overrides.status ?? 'SCHEDULED',
      createdById: staffUserId,
    },
    select: { id: true },
  });
  return session.id;
}

async function createRegisteredAttendee(sessionId: string, studentId: string): Promise<string> {
  const attendee = await prisma.ariaWorkshopAttendee.create({
    data: { sessionId, studentId, status: 'REGISTERED' },
    select: { id: true },
  });
  return attendee.id;
}

async function outboxCountForUser(pool: Pool, userId: string): Promise<number> {
  const rows = await pool.query(
    `SELECT id FROM canonical_job_outbox WHERE "aggregateId" = $1 AND "jobType" = 'SEND_EMAIL'`,
    [userId],
  );
  return rows.rows.length;
}

describe('queueDueAriaWorkshopReminders (P7c)', () => {
  let pool: Pool;
  let staffUserId: string;

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('ARIA_TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl });
    staffUserId = await createStaffUser(pool);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE id = $1', [staffUserId]);
    await pool.end();
  });

  it('queues exactly one real reminder for a real, still-eligible, due registration', async () => {
    const family = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
    await upgradeToSuiviTier(pool, family.entitlement);
    await pool.query('UPDATE users SET "firstName" = $1 WHERE id = $2', ['Mehdi', family.studentUser]);
    await pool.query('UPDATE users SET "firstName" = $1 WHERE id = $2', ['Marie', family.parentUser]);
    try {
      const sessionId = await createSession(staffUserId);
      await createRegisteredAttendee(sessionId, family.student);

      const result = await queueDueAriaWorkshopReminders(REMINDER_DUE_AT);

      expect(result).toEqual({ queued: 1, skippedNotYetEligible: 0, skippedTooLate: 0 });
      expect(await outboxCountForUser(pool, family.parentUser)).toBe(1);
      const attendee = await prisma.ariaWorkshopAttendee.findFirst({ where: { sessionId, studentId: family.student } });
      expect(attendee?.reminderQueuedAt).not.toBeNull();
    } finally {
      await pool.query(`DELETE FROM canonical_job_outbox WHERE "aggregateId" = $1 AND "jobType" = 'SEND_EMAIL'`, [family.parentUser]);
      await prisma.ariaWorkshopAttendee.deleteMany({ where: { studentId: family.student } });
      await prisma.ariaWorkshopSession.deleteMany({ where: { courseKey: REAL_COURSE_KEY, title: 'Atelier rappel P7c' } });
      await cleanupAriaRealDbFixture(pool, family);
    }
  });

  it('does not queue a reminder before it is due', async () => {
    const family = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
    await upgradeToSuiviTier(pool, family.entitlement);
    try {
      const sessionId = await createSession(staffUserId, { title: 'Atelier pas encore dû' });
      await createRegisteredAttendee(sessionId, family.student);

      const result = await queueDueAriaWorkshopReminders(BEFORE_DUE);

      expect(result).toEqual({ queued: 0, skippedNotYetEligible: 0, skippedTooLate: 0 });
      expect(await outboxCountForUser(pool, family.parentUser)).toBe(0);
      const attendee = await prisma.ariaWorkshopAttendee.findFirst({ where: { sessionId, studentId: family.student } });
      expect(attendee?.reminderQueuedAt).toBeNull();
    } finally {
      await prisma.ariaWorkshopAttendee.deleteMany({ where: { studentId: family.student } });
      await prisma.ariaWorkshopSession.deleteMany({ where: { courseKey: REAL_COURSE_KEY, title: 'Atelier pas encore dû' } });
      await cleanupAriaRealDbFixture(pool, family);
    }
  });

  it('never queues a second reminder for an already-claimed registration (idempotent across scans)', async () => {
    const family = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
    await upgradeToSuiviTier(pool, family.entitlement);
    await pool.query('UPDATE users SET "firstName" = $1 WHERE id = $2', ['Karim', family.studentUser]);
    await pool.query('UPDATE users SET "firstName" = $1 WHERE id = $2', ['Sonia', family.parentUser]);
    try {
      const sessionId = await createSession(staffUserId, { title: 'Atelier double scan' });
      await createRegisteredAttendee(sessionId, family.student);

      const first = await queueDueAriaWorkshopReminders(REMINDER_DUE_AT);
      const second = await queueDueAriaWorkshopReminders(new Date(REMINDER_DUE_AT.getTime() + 60 * 1000));

      expect(first.queued).toBe(1);
      expect(second).toEqual({ queued: 0, skippedNotYetEligible: 0, skippedTooLate: 0 });
      expect(await outboxCountForUser(pool, family.parentUser)).toBe(1);
    } finally {
      await pool.query(`DELETE FROM canonical_job_outbox WHERE "aggregateId" = $1 AND "jobType" = 'SEND_EMAIL'`, [family.parentUser]);
      await prisma.ariaWorkshopAttendee.deleteMany({ where: { studentId: family.student } });
      await prisma.ariaWorkshopSession.deleteMany({ where: { courseKey: REAL_COURSE_KEY, title: 'Atelier double scan' } });
      await cleanupAriaRealDbFixture(pool, family);
    }
  });

  it('a genuine concurrent double-scan hits the atomic claim and never double-queues', async () => {
    const family = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
    await upgradeToSuiviTier(pool, family.entitlement);
    await pool.query('UPDATE users SET "firstName" = $1 WHERE id = $2', ['Nadia', family.studentUser]);
    await pool.query('UPDATE users SET "firstName" = $1 WHERE id = $2', ['Fatma', family.parentUser]);
    try {
      const sessionId = await createSession(staffUserId, { title: 'Atelier scan concurrent' });
      await createRegisteredAttendee(sessionId, family.student);

      const [a, b] = await Promise.all([
        queueDueAriaWorkshopReminders(REMINDER_DUE_AT),
        queueDueAriaWorkshopReminders(REMINDER_DUE_AT),
      ]);

      expect(a.queued + b.queued).toBe(1);
      expect(await outboxCountForUser(pool, family.parentUser)).toBe(1);
    } finally {
      await pool.query(`DELETE FROM canonical_job_outbox WHERE "aggregateId" = $1 AND "jobType" = 'SEND_EMAIL'`, [family.parentUser]);
      await prisma.ariaWorkshopAttendee.deleteMany({ where: { studentId: family.student } });
      await prisma.ariaWorkshopSession.deleteMany({ where: { courseKey: REAL_COURSE_KEY, title: 'Atelier scan concurrent' } });
      await cleanupAriaRealDbFixture(pool, family);
    }
  });

  it('never sends a reminder once the real session has already started (too late, claimed but suppressed)', async () => {
    const family = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
    await upgradeToSuiviTier(pool, family.entitlement);
    try {
      const sessionId = await createSession(staffUserId, { title: 'Atelier déjà commencé' });
      await createRegisteredAttendee(sessionId, family.student);

      const result = await queueDueAriaWorkshopReminders(AFTER_SESSION_START);

      expect(result).toEqual({ queued: 0, skippedNotYetEligible: 0, skippedTooLate: 1 });
      expect(await outboxCountForUser(pool, family.parentUser)).toBe(0);
      const attendee = await prisma.ariaWorkshopAttendee.findFirst({ where: { sessionId, studentId: family.student } });
      expect(attendee?.reminderQueuedAt).not.toBeNull();
    } finally {
      await prisma.ariaWorkshopAttendee.deleteMany({ where: { studentId: family.student } });
      await prisma.ariaWorkshopSession.deleteMany({ where: { courseKey: REAL_COURSE_KEY, title: 'Atelier déjà commencé' } });
      await cleanupAriaRealDbFixture(pool, family);
    }
  });

  it('never sends a reminder for a real, cancelled workshop (cancellation handled by construction, no active hook needed)', async () => {
    const family = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
    await upgradeToSuiviTier(pool, family.entitlement);
    try {
      const sessionId = await createSession(staffUserId, { status: 'CANCELLED', title: 'Atelier annulé' });
      await createRegisteredAttendee(sessionId, family.student);

      const result = await queueDueAriaWorkshopReminders(REMINDER_DUE_AT);

      expect(result).toEqual({ queued: 0, skippedNotYetEligible: 0, skippedTooLate: 0 });
      expect(await outboxCountForUser(pool, family.parentUser)).toBe(0);
      const attendee = await prisma.ariaWorkshopAttendee.findFirst({ where: { sessionId, studentId: family.student } });
      // Never even claimed: a cancelled session's attendees are excluded by
      // the scan's own WHERE clause, never reached at all.
      expect(attendee?.reminderQueuedAt).toBeNull();
    } finally {
      await prisma.ariaWorkshopAttendee.deleteMany({ where: { studentId: family.student } });
      await prisma.ariaWorkshopSession.deleteMany({ where: { courseKey: REAL_COURSE_KEY, title: 'Atelier annulé' } });
      await cleanupAriaRealDbFixture(pool, family);
    }
  });

  it('never sends a reminder for a real attendee whose registration was cancelled', async () => {
    const family = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
    await upgradeToSuiviTier(pool, family.entitlement);
    try {
      const sessionId = await createSession(staffUserId, { title: 'Atelier inscription annulée' });
      const attendeeId = await createRegisteredAttendee(sessionId, family.student);
      await prisma.ariaWorkshopAttendee.update({ where: { id: attendeeId }, data: { status: 'CANCELLED' } });

      const result = await queueDueAriaWorkshopReminders(REMINDER_DUE_AT);

      expect(result).toEqual({ queued: 0, skippedNotYetEligible: 0, skippedTooLate: 0 });
      expect(await outboxCountForUser(pool, family.parentUser)).toBe(0);
    } finally {
      await prisma.ariaWorkshopAttendee.deleteMany({ where: { studentId: family.student } });
      await prisma.ariaWorkshopSession.deleteMany({ where: { courseKey: REAL_COURSE_KEY, title: 'Atelier inscription annulée' } });
      await cleanupAriaRealDbFixture(pool, family);
    }
  });

  it('never sends a reminder for a real student whose tier no longer includes collective workshops (revoked/downgraded since registration)', async () => {
    const family = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
    await upgradeToSuiviTier(pool, family.entitlement);
    try {
      const sessionId = await createSession(staffUserId, { title: 'Atelier tier révoqué' });
      await createRegisteredAttendee(sessionId, family.student);
      // Downgraded back to AUTONOMIE (e.g. a real plan change) after
      // registering but before the reminder became due.
      await pool.query(`UPDATE entitlements SET "ariaTier" = 'ARIA_AUTONOMIE' WHERE id = $1`, [family.entitlement]);

      const result = await queueDueAriaWorkshopReminders(REMINDER_DUE_AT);

      expect(result).toEqual({ queued: 0, skippedNotYetEligible: 1, skippedTooLate: 0 });
      expect(await outboxCountForUser(pool, family.parentUser)).toBe(0);
      const attendee = await prisma.ariaWorkshopAttendee.findFirst({ where: { sessionId, studentId: family.student } });
      // Claimed — never re-evaluated on a later scan even if the tier were
      // restored, matching the "claim exactly once" idempotency contract.
      expect(attendee?.reminderQueuedAt).not.toBeNull();
    } finally {
      await prisma.ariaWorkshopAttendee.deleteMany({ where: { studentId: family.student } });
      await prisma.ariaWorkshopSession.deleteMany({ where: { courseKey: REAL_COURSE_KEY, title: 'Atelier tier révoqué' } });
      await cleanupAriaRealDbFixture(pool, family);
    }
  });

  it('never sends a reminder for a real entitlement that expired since registration', async () => {
    const family = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
    await upgradeToSuiviTier(pool, family.entitlement);
    try {
      const sessionId = await createSession(staffUserId, { title: 'Atelier entitlement expiré' });
      await createRegisteredAttendee(sessionId, family.student);
      // Expires between registration and the reminder becoming due.
      await pool.query('UPDATE entitlements SET "endsAt" = $1 WHERE id = $2', [
        new Date(REMINDER_DUE_AT.getTime() - 60 * 60 * 1000),
        family.entitlement,
      ]);

      const result = await queueDueAriaWorkshopReminders(REMINDER_DUE_AT);

      expect(result).toEqual({ queued: 0, skippedNotYetEligible: 1, skippedTooLate: 0 });
      expect(await outboxCountForUser(pool, family.parentUser)).toBe(0);
    } finally {
      await prisma.ariaWorkshopAttendee.deleteMany({ where: { studentId: family.student } });
      await prisma.ariaWorkshopSession.deleteMany({ where: { courseKey: REAL_COURSE_KEY, title: 'Atelier entitlement expiré' } });
      await cleanupAriaRealDbFixture(pool, family);
    }
  });

  it('never sends a reminder for a real student whose tier never included collective workshops (AUTONOMIE, never upgraded)', async () => {
    // Only reachable by direct DB insertion, since the real registration
    // path itself would have refused this student in the first place —
    // proven here purely as a defense-in-depth boundary on the scan.
    const family = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
    try {
      const sessionId = await createSession(staffUserId, { title: 'Atelier jamais éligible' });
      await createRegisteredAttendee(sessionId, family.student);

      const result = await queueDueAriaWorkshopReminders(REMINDER_DUE_AT);

      expect(result).toEqual({ queued: 0, skippedNotYetEligible: 1, skippedTooLate: 0 });
      expect(await outboxCountForUser(pool, family.parentUser)).toBe(0);
    } finally {
      await prisma.ariaWorkshopAttendee.deleteMany({ where: { studentId: family.student } });
      await prisma.ariaWorkshopSession.deleteMany({ where: { courseKey: REAL_COURSE_KEY, title: 'Atelier jamais éligible' } });
      await cleanupAriaRealDbFixture(pool, family);
    }
  });

  it('scopes each real reminder to its own real family — never cross-mixes two different parents in the same scan', async () => {
    const familyA = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
    const familyB = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
    await upgradeToSuiviTier(pool, familyA.entitlement);
    await upgradeToSuiviTier(pool, familyB.entitlement);
    await pool.query('UPDATE users SET "firstName" = $1 WHERE id = $2', ['Yasmine', familyA.studentUser]);
    await pool.query('UPDATE users SET "firstName" = $1 WHERE id = $2', ['Amira', familyA.parentUser]);
    await pool.query('UPDATE users SET "firstName" = $1 WHERE id = $2', ['Wassim', familyB.studentUser]);
    await pool.query('UPDATE users SET "firstName" = $1 WHERE id = $2', ['Lilia', familyB.parentUser]);
    try {
      const sessionId = await createSession(staffUserId, { title: 'Atelier familles multiples' });
      await createRegisteredAttendee(sessionId, familyA.student);
      await createRegisteredAttendee(sessionId, familyB.student);

      const result = await queueDueAriaWorkshopReminders(REMINDER_DUE_AT);

      expect(result.queued).toBe(2);
      expect(await outboxCountForUser(pool, familyA.parentUser)).toBe(1);
      expect(await outboxCountForUser(pool, familyB.parentUser)).toBe(1);
    } finally {
      await pool.query(`DELETE FROM canonical_job_outbox WHERE "aggregateId" = ANY($1) AND "jobType" = 'SEND_EMAIL'`, [[familyA.parentUser, familyB.parentUser]]);
      await prisma.ariaWorkshopAttendee.deleteMany({ where: { studentId: { in: [familyA.student, familyB.student] } } });
      await prisma.ariaWorkshopSession.deleteMany({ where: { courseKey: REAL_COURSE_KEY, title: 'Atelier familles multiples' } });
      await cleanupAriaRealDbFixture(pool, familyA);
      await cleanupAriaRealDbFixture(pool, familyB);
    }
  });
});
