/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { scheduleAriaWorkshopSession } from '@/lib/aria/application/workshop/schedule-workshop';
import { listAriaWorkshopsForActor } from '@/lib/aria/application/workshop/list-workshops-for-student';
import { registerForAriaWorkshop } from '@/lib/aria/application/workshop/register-for-workshop';
import { markAriaWorkshopAttendance } from '@/lib/aria/application/workshop/mark-attendance';
import { listAriaWorkshopsForStaff } from '@/lib/aria/application/workshop/list-workshops-for-staff';
import { listAriaWorkshopsForParent } from '@/lib/aria/application/workshop/list-workshops-for-parent';
import { notifyParentWorkshopRegistered } from '@/lib/aria/notifications/notify-parent-workshop-registered';
import { AriaError } from '@/lib/aria/kernel/errors';
import {
  cleanupAriaRealDbFixture,
  seedAriaRealDbFixture,
  type AriaRealDbFixtureIds,
} from '@/__tests__/helpers/aria-real-db';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const REAL_COURSE_KEY = 'eds-maths-premiere';

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

async function cleanupWorkshops(pool: Pool, courseKeys: readonly string[]): Promise<void> {
  await pool.query(
    `DELETE FROM aria_workshop_attendees WHERE "sessionId" IN (
       SELECT id FROM aria_workshop_sessions WHERE "courseKey" = ANY($1::text[])
     )`,
    [courseKeys],
  );
  await pool.query('DELETE FROM aria_workshop_sessions WHERE "courseKey" = ANY($1::text[])', [courseKeys]);
}

describe('ARIA Collective Workshops (P7d) on PostgreSQL', () => {
  let pool: Pool;
  let child: AriaRealDbFixtureIds;
  let staffUserId: string;

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('ARIA_TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl });
    child = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
    await upgradeToSuiviTier(pool, child.entitlement);
    staffUserId = await createStaffUser(pool);
  });

  afterAll(async () => {
    await cleanupWorkshops(pool, [REAL_COURSE_KEY]);
    await cleanupAriaRealDbFixture(pool, child);
    await pool.query('DELETE FROM users WHERE id = $1', [staffUserId]);
    await pool.end();
  });

  it('runs the real golden path: staff schedules -> eligible student sees + registers -> staff marks attendance -> parent sees real attendance', async () => {
    const workshop = await scheduleAriaWorkshopSession({
      actor: { userId: staffUserId, role: 'ASSISTANTE' },
      courseKey: REAL_COURSE_KEY,
      title: 'Atelier révisions suites arithmétiques',
      scheduledDate: new Date('2026-10-01T00:00:00.000Z'),
      startTime: '14:00',
      endTime: '15:30',
      modality: 'ONLINE',
    });
    expect(workshop.status).toBe('SCHEDULED');

    const visibleToStudent = await listAriaWorkshopsForActor({
      actor: { userId: child.studentUser, role: 'ELEVE' },
      courseKey: REAL_COURSE_KEY,
    });
    expect(visibleToStudent).toHaveLength(1);
    expect(visibleToStudent[0]).toMatchObject({ id: workshop.id, myAttendanceStatus: null });

    const registration = await registerForAriaWorkshop({
      actor: { userId: child.studentUser, role: 'ELEVE' },
      workshopSessionId: workshop.id,
    });
    expect(registration.status).toBe('REGISTERED');

    const staffView = await listAriaWorkshopsForStaff({
      actor: { userId: staffUserId, role: 'ASSISTANTE' },
      courseKey: REAL_COURSE_KEY,
    });
    const staffSession = staffView.find((entry) => entry.id === workshop.id)!;
    expect(staffSession.attendees).toHaveLength(1);
    const attendee = staffSession.attendees[0]!;
    expect(attendee.status).toBe('REGISTERED');

    await markAriaWorkshopAttendance({
      actor: { userId: staffUserId, role: 'ASSISTANTE' },
      attendeeId: attendee.attendeeId,
      status: 'ATTENDED',
    });

    const parentView = await listAriaWorkshopsForParent({
      actor: { userId: child.parentUser, role: 'PARENT' },
      studentId: child.student,
      courseKey: REAL_COURSE_KEY,
    });
    expect(parentView).toHaveLength(1);
    expect(parentView[0]).toMatchObject({ id: workshop.id, childAttendanceStatus: 'ATTENDED' });
  });

  it('is idempotent: registering twice for the same real workshop does not create a second real attendee row', async () => {
    const workshop = await scheduleAriaWorkshopSession({
      actor: { userId: staffUserId, role: 'ASSISTANTE' },
      courseKey: REAL_COURSE_KEY,
      title: 'Atelier idempotence',
      scheduledDate: new Date('2026-10-02T00:00:00.000Z'),
      startTime: '10:00',
      endTime: '11:00',
      modality: 'IN_PERSON',
      location: 'Centre Nexus',
    });
    await registerForAriaWorkshop({
      actor: { userId: child.studentUser, role: 'ELEVE' },
      workshopSessionId: workshop.id,
    });
    await registerForAriaWorkshop({
      actor: { userId: child.studentUser, role: 'ELEVE' },
      workshopSessionId: workshop.id,
    });
    const staffView = await listAriaWorkshopsForStaff({
      actor: { userId: staffUserId, role: 'ASSISTANTE' },
      courseKey: REAL_COURSE_KEY,
    });
    const session = staffView.find((entry) => entry.id === workshop.id)!;
    expect(session.attendees).toHaveLength(1);
  });

  it('rejects registration once a real, real capacity is reached', async () => {
    const workshop = await scheduleAriaWorkshopSession({
      actor: { userId: staffUserId, role: 'ASSISTANTE' },
      courseKey: REAL_COURSE_KEY,
      title: 'Atelier capacité limitée',
      scheduledDate: new Date('2026-10-03T00:00:00.000Z'),
      startTime: '09:00',
      endTime: '10:00',
      modality: 'ONLINE',
      capacity: 1,
    });
    const otherFamily = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
    await upgradeToSuiviTier(pool, otherFamily.entitlement);
    try {
      await registerForAriaWorkshop({
        actor: { userId: child.studentUser, role: 'ELEVE' },
        workshopSessionId: workshop.id,
      });
      await expect(registerForAriaWorkshop({
        actor: { userId: otherFamily.studentUser, role: 'ELEVE' },
        workshopSessionId: workshop.id,
      })).rejects.toThrow(AriaError);
    } finally {
      await cleanupAriaRealDbFixture(pool, otherFamily);
    }
  });

  it('a real student whose tier does not include collective workshops (AUTONOMIE) sees a real empty list, but a real registration attempt is still denied', async () => {
    const autonomieFamily = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
    // seedAriaRealDbFixture's own entitlement defaults to AUTONOMIE
    // (ariaTier left null) — never upgraded here, unlike `child`.
    const workshop = await scheduleAriaWorkshopSession({
      actor: { userId: staffUserId, role: 'ASSISTANTE' },
      courseKey: REAL_COURSE_KEY,
      title: 'Atelier réservé SUIVI',
      scheduledDate: new Date('2026-10-04T00:00:00.000Z'),
      startTime: '16:00',
      endTime: '17:00',
      modality: 'ONLINE',
    });
    try {
      // Browsing degrades gracefully (an empty list, not a thrown error —
      // this is the common case for most real students, mounted
      // unconditionally by the cockpit UI on every course view).
      const workshopsForAutonomieStudent = await listAriaWorkshopsForActor({
        actor: { userId: autonomieFamily.studentUser, role: 'ELEVE' },
        courseKey: REAL_COURSE_KEY,
      });
      expect(workshopsForAutonomieStudent).toEqual([]);
      // A deliberate registration attempt is still a real denial.
      await expect(registerForAriaWorkshop({
        actor: { userId: autonomieFamily.studentUser, role: 'ELEVE' },
        workshopSessionId: workshop.id,
      })).rejects.toThrow(AriaError);
    } finally {
      await cleanupAriaRealDbFixture(pool, autonomieFamily);
    }
  });

  it('rejects a non-ASSISTANTE actor trying to schedule a real workshop', async () => {
    await expect(scheduleAriaWorkshopSession({
      actor: { userId: child.studentUser, role: 'ELEVE' },
      courseKey: REAL_COURSE_KEY,
      title: 'Tentative non autorisée',
      scheduledDate: new Date('2026-10-05T00:00:00.000Z'),
      startTime: '10:00',
      endTime: '11:00',
      modality: 'ONLINE',
    })).rejects.toThrow(AriaError);
  });

  it('rejects an unknown courseKey when scheduling', async () => {
    await expect(scheduleAriaWorkshopSession({
      actor: { userId: staffUserId, role: 'ASSISTANTE' },
      courseKey: 'not-a-real-course-key',
      title: 'Tentative invalide',
      scheduledDate: new Date('2026-10-06T00:00:00.000Z'),
      startTime: '10:00',
      endTime: '11:00',
      modality: 'ONLINE',
    })).rejects.toThrow(AriaError);
  });

  it('rejects a parent trying to view a different family\'s child real workshops', async () => {
    const otherFamily = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
    try {
      await expect(listAriaWorkshopsForParent({
        actor: { userId: otherFamily.parentUser, role: 'PARENT' },
        studentId: child.student,
        courseKey: REAL_COURSE_KEY,
      })).rejects.toThrow(AriaError);
    } finally {
      await cleanupAriaRealDbFixture(pool, otherFamily);
    }
  });

  it('rejects an unknown courseKey for a real student browsing workshops', async () => {
    await expect(listAriaWorkshopsForActor({
      actor: { userId: child.studentUser, role: 'ELEVE' },
      courseKey: 'not-a-real-course-key',
    })).rejects.toThrow(AriaError);
  });

  it('a real student browsing a real, enrolled course with zero ARIA entitlement at all (not just the wrong tier) sees a real empty list, not a thrown error', async () => {
    const enrolledNoEntitlement = 'eds-nsi-premiere';
    await pool.query(
      `INSERT INTO student_academic_enrollments
       (id, "studentId", "courseKey", kind, source, "curriculumVersion", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'SPECIALTY', 'ADMIN', '2026-v1', NOW(), NOW())`,
      [randomUUID(), child.student, enrolledNoEntitlement],
    );
    const workshops = await listAriaWorkshopsForActor({
      actor: { userId: child.studentUser, role: 'ELEVE' },
      courseKey: enrolledNoEntitlement,
    });
    expect(workshops).toEqual([]);
  });

  it('rejects scheduling a real workshop with a blank title', async () => {
    await expect(scheduleAriaWorkshopSession({
      actor: { userId: staffUserId, role: 'ASSISTANTE' },
      courseKey: REAL_COURSE_KEY,
      title: '   ',
      scheduledDate: new Date('2026-10-07T00:00:00.000Z'),
      startTime: '10:00',
      endTime: '11:00',
      modality: 'ONLINE',
    })).rejects.toThrow(AriaError);
  });

  it('rejects registering for a real, nonexistent workshop session', async () => {
    await expect(registerForAriaWorkshop({
      actor: { userId: child.studentUser, role: 'ELEVE' },
      workshopSessionId: 'not-a-real-session-id',
    })).rejects.toThrow(AriaError);
  });

  it('lists every real workshop for staff when no courseKey filter is given', async () => {
    const workshop = await scheduleAriaWorkshopSession({
      actor: { userId: staffUserId, role: 'ASSISTANTE' },
      courseKey: REAL_COURSE_KEY,
      title: 'Atelier sans filtre',
      scheduledDate: new Date('2026-10-08T00:00:00.000Z'),
      startTime: '10:00',
      endTime: '11:00',
      modality: 'ONLINE',
    });
    const allSessions = await listAriaWorkshopsForStaff({ actor: { userId: staffUserId, role: 'ASSISTANTE' } });
    expect(allSessions.some((entry) => entry.id === workshop.id)).toBe(true);
  });

  it('rejects an invalid attendance status even on a real, existing attendee', async () => {
    const workshop = await scheduleAriaWorkshopSession({
      actor: { userId: staffUserId, role: 'ASSISTANTE' },
      courseKey: REAL_COURSE_KEY,
      title: 'Atelier statut invalide',
      scheduledDate: new Date('2026-10-09T00:00:00.000Z'),
      startTime: '10:00',
      endTime: '11:00',
      modality: 'ONLINE',
    });
    await registerForAriaWorkshop({
      actor: { userId: child.studentUser, role: 'ELEVE' },
      workshopSessionId: workshop.id,
    });
    const staffView = await listAriaWorkshopsForStaff({ actor: { userId: staffUserId, role: 'ASSISTANTE' }, courseKey: REAL_COURSE_KEY });
    const attendeeId = staffView.find((entry) => entry.id === workshop.id)!.attendees[0]!.attendeeId;
    await expect(markAriaWorkshopAttendance({
      actor: { userId: staffUserId, role: 'ASSISTANTE' },
      attendeeId,
      status: 'MAYBE' as unknown as 'ATTENDED',
    })).rejects.toThrow(AriaError);
  });

  it('rejects marking attendance for a real, nonexistent attendee', async () => {
    await expect(markAriaWorkshopAttendance({
      actor: { userId: staffUserId, role: 'ASSISTANTE' },
      attendeeId: 'not-a-real-attendee-id',
      status: 'ATTENDED',
    })).rejects.toThrow(AriaError);
  });

  describe('listAriaWorkshopsForParent — full real negative gate', () => {
    it('rejects an unknown courseKey', async () => {
      await expect(listAriaWorkshopsForParent({
        actor: { userId: child.parentUser, role: 'PARENT' },
        studentId: child.student,
        courseKey: 'not-a-real-course-key',
      })).rejects.toThrow(AriaError);
    });

    it('rejects a real course the child is not academically enrolled in at all', async () => {
      await expect(listAriaWorkshopsForParent({
        actor: { userId: child.parentUser, role: 'PARENT' },
        studentId: child.student,
        courseKey: 'stmg-maths-premiere',
      })).rejects.toThrow(AriaError);
    });

    it('rejects a real course the child is enrolled in but has no ARIA entitlement scope for', async () => {
      await pool.query(
        `INSERT INTO student_academic_enrollments
         (id, "studentId", "courseKey", kind, source, "curriculumVersion", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'SPECIALTY', 'ADMIN', '2026-v1', NOW(), NOW())`,
        [randomUUID(), child.student, 'eds-physique-chimie-premiere'],
      );
      await expect(listAriaWorkshopsForParent({
        actor: { userId: child.parentUser, role: 'PARENT' },
        studentId: child.student,
        courseKey: 'eds-physique-chimie-premiere',
      })).rejects.toThrow(AriaError);
    });

    it('returns a real empty list for a real, entitled child whose tier does not include collective workshops (AUTONOMIE)', async () => {
      const autonomieFamily = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
      try {
        const workshopsForParent = await listAriaWorkshopsForParent({
          actor: { userId: autonomieFamily.parentUser, role: 'PARENT' },
          studentId: autonomieFamily.student,
          courseKey: REAL_COURSE_KEY,
        });
        expect(workshopsForParent).toEqual([]);
      } finally {
        await cleanupAriaRealDbFixture(pool, autonomieFamily);
      }
    });
  });
});

describe('ARIA workshop registration — real parent notification (P7c)', () => {
  let pool: Pool;
  let family: AriaRealDbFixtureIds;
  let staffUserId: string;

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('ARIA_TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl });
    family = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
    await upgradeToSuiviTier(pool, family.entitlement);
    staffUserId = await createStaffUser(pool);
    await pool.query('UPDATE users SET "firstName" = $1 WHERE id = $2', ['Mehdi', family.studentUser]);
    await pool.query('UPDATE users SET "firstName" = $1, email = $2 WHERE id = $3', [
      'Marie', `parent-${family.parentUser}@invalid.test`, family.parentUser,
    ]);
  });

  afterAll(async () => {
    await pool.query(
      `DELETE FROM canonical_job_outbox WHERE "aggregateId" = $1 AND "jobType" = 'SEND_EMAIL'`,
      [family.parentUser],
    );
    await cleanupWorkshops(pool, [REAL_COURSE_KEY]);
    await cleanupAriaRealDbFixture(pool, family);
    await pool.query('DELETE FROM users WHERE id = $1', [staffUserId]);
    await pool.end();
  });

  it('queues exactly one real parent email intent on a real registration', async () => {
    const workshop = await scheduleAriaWorkshopSession({
      actor: { userId: staffUserId, role: 'ASSISTANTE' },
      courseKey: REAL_COURSE_KEY,
      title: 'Atelier notification P7c',
      scheduledDate: new Date('2026-11-05T00:00:00.000Z'),
      startTime: '10:00',
      endTime: '11:00',
      modality: 'ONLINE',
    });

    await registerForAriaWorkshop({
      actor: { userId: family.studentUser, role: 'ELEVE' },
      workshopSessionId: workshop.id,
    });

    const rows = await pool.query(
      `SELECT id, "jobType", status FROM canonical_job_outbox WHERE "aggregateId" = $1 AND "jobType" = 'SEND_EMAIL'`,
      [family.parentUser],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].status).toBe('PENDING');
  });

  it('never queues a second notification for an already-registered student (idempotent registration)', async () => {
    // A fresh, isolated family: the assertion below counts every outbox
    // row for this parent, so it must not share state with the previous
    // test's own registration.
    const isolatedFamily = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
    await upgradeToSuiviTier(pool, isolatedFamily.entitlement);
    await pool.query('UPDATE users SET "firstName" = $1 WHERE id = $2', ['Karim', isolatedFamily.studentUser]);
    await pool.query('UPDATE users SET "firstName" = $1 WHERE id = $2', ['Sonia', isolatedFamily.parentUser]);
    try {
      const workshop = await scheduleAriaWorkshopSession({
        actor: { userId: staffUserId, role: 'ASSISTANTE' },
        courseKey: REAL_COURSE_KEY,
        title: 'Atelier notification idempotence P7c',
        scheduledDate: new Date('2026-11-06T00:00:00.000Z'),
        startTime: '10:00',
        endTime: '11:00',
        modality: 'ONLINE',
      });

      await registerForAriaWorkshop({
        actor: { userId: isolatedFamily.studentUser, role: 'ELEVE' },
        workshopSessionId: workshop.id,
      });
      // Re-registering the same student for the same session is the real,
      // already-established idempotent path (early-return before
      // create()) — must not queue a second email.
      await registerForAriaWorkshop({
        actor: { userId: isolatedFamily.studentUser, role: 'ELEVE' },
        workshopSessionId: workshop.id,
      });

      const rows = await pool.query(
        `SELECT id FROM canonical_job_outbox WHERE "aggregateId" = $1 AND "jobType" = 'SEND_EMAIL'`,
        [isolatedFamily.parentUser],
      );
      expect(rows.rows).toHaveLength(1);
    } finally {
      await pool.query(
        `DELETE FROM canonical_job_outbox WHERE "aggregateId" = $1 AND "jobType" = 'SEND_EMAIL'`,
        [isolatedFamily.parentUser],
      );
      await cleanupAriaRealDbFixture(pool, isolatedFamily);
    }
  });

  it('registration still succeeds, and simply queues no notification, when the student has no real first name on file', async () => {
    // seedAriaRealDbFixture deliberately never sets firstName — the same
    // real degrade-gracefully guard notifyParentPublished (bilans) uses.
    const noNameFamily = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
    await upgradeToSuiviTier(pool, noNameFamily.entitlement);
    try {
      const workshop = await scheduleAriaWorkshopSession({
        actor: { userId: staffUserId, role: 'ASSISTANTE' },
        courseKey: REAL_COURSE_KEY,
        title: 'Atelier sans prénom élève P7c',
        scheduledDate: new Date('2026-11-07T00:00:00.000Z'),
        startTime: '10:00',
        endTime: '11:00',
        modality: 'ONLINE',
      });

      const registration = await registerForAriaWorkshop({
        actor: { userId: noNameFamily.studentUser, role: 'ELEVE' },
        workshopSessionId: workshop.id,
      });
      expect(registration.status).toBe('REGISTERED');

      const rows = await pool.query(
        `SELECT id FROM canonical_job_outbox WHERE "aggregateId" = $1 AND "jobType" = 'SEND_EMAIL'`,
        [noNameFamily.parentUser],
      );
      expect(rows.rows).toHaveLength(0);
    } finally {
      await cleanupAriaRealDbFixture(pool, noNameFamily);
    }
  });

  it('registration still succeeds, and simply queues no notification, when the parent has no real name on file', async () => {
    const noParentNameFamily = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
    await upgradeToSuiviTier(pool, noParentNameFamily.entitlement);
    await pool.query('UPDATE users SET "firstName" = $1 WHERE id = $2', ['Yasmine', noParentNameFamily.studentUser]);
    try {
      const workshop = await scheduleAriaWorkshopSession({
        actor: { userId: staffUserId, role: 'ASSISTANTE' },
        courseKey: REAL_COURSE_KEY,
        title: 'Atelier sans prénom parent P7c',
        scheduledDate: new Date('2026-11-08T00:00:00.000Z'),
        startTime: '10:00',
        endTime: '11:00',
        modality: 'ONLINE',
      });

      const registration = await registerForAriaWorkshop({
        actor: { userId: noParentNameFamily.studentUser, role: 'ELEVE' },
        workshopSessionId: workshop.id,
      });
      expect(registration.status).toBe('REGISTERED');

      const rows = await pool.query(
        `SELECT id FROM canonical_job_outbox WHERE "aggregateId" = $1 AND "jobType" = 'SEND_EMAIL'`,
        [noParentNameFamily.parentUser],
      );
      expect(rows.rows).toHaveLength(0);
    } finally {
      await cleanupAriaRealDbFixture(pool, noParentNameFamily);
    }
  });

  it('a genuine concurrent double-fire hits the outbox\'s own unique constraint and is caught, not thrown', async () => {
    const raceFamily = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
    await pool.query('UPDATE users SET "firstName" = $1 WHERE id = $2', ['Nadia', raceFamily.studentUser]);
    await pool.query('UPDATE users SET "firstName" = $1 WHERE id = $2', ['Fatma', raceFamily.parentUser]);
    try {
      const workshop = await scheduleAriaWorkshopSession({
        actor: { userId: staffUserId, role: 'ASSISTANTE' },
        courseKey: REAL_COURSE_KEY,
        title: 'Atelier course concurrente P7c',
        scheduledDate: new Date('2026-11-09T00:00:00.000Z'),
        startTime: '10:00',
        endTime: '11:00',
        modality: 'ONLINE',
      });
      const notifyInput = {
        studentId: raceFamily.student,
        sessionId: workshop.id,
        workshopTitle: workshop.title,
        scheduledDate: workshop.scheduledDate,
        startTime: workshop.startTime,
        endTime: workshop.endTime,
        location: workshop.location,
      };

      // Calling the notification function twice directly (bypassing
      // register-for-workshop.ts's own idempotent early-return, which
      // normally prevents this) simulates the genuine race this catch
      // block exists for.
      await expect(notifyParentWorkshopRegistered(notifyInput)).resolves.toBeUndefined();
      await expect(notifyParentWorkshopRegistered(notifyInput)).resolves.toBeUndefined();

      const rows = await pool.query(
        `SELECT id FROM canonical_job_outbox WHERE "aggregateId" = $1 AND "jobType" = 'SEND_EMAIL'`,
        [raceFamily.parentUser],
      );
      expect(rows.rows).toHaveLength(1);
    } finally {
      await pool.query(
        `DELETE FROM canonical_job_outbox WHERE "aggregateId" = $1 AND "jobType" = 'SEND_EMAIL'`,
        [raceFamily.parentUser],
      );
      await cleanupAriaRealDbFixture(pool, raceFamily);
    }
  });
});
