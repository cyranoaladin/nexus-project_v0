/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { listAriaCoursesForParentChild } from '@/lib/aria/application/mastery/list-courses-for-parent';
import { AriaError } from '@/lib/aria/kernel/errors';
import {
  cleanupAriaRealDbFixture,
  seedAriaRealDbFixture,
  type AriaRealDbFixtureIds,
} from '@/__tests__/helpers/aria-real-db';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const REAL_COURSE_KEY = 'eds-maths-premiere';

describe('ARIA Parent Course List (P6b) on PostgreSQL', () => {
  let pool: Pool;
  let child: AriaRealDbFixtureIds;
  let otherFamily: AriaRealDbFixtureIds;

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('ARIA_TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl });
    child = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
    otherFamily = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
  });

  afterAll(async () => {
    await cleanupAriaRealDbFixture(pool, child);
    await cleanupAriaRealDbFixture(pool, otherFamily);
    await pool.end();
  });

  it('lists the real linked child’s real available ARIA course, with its real label', async () => {
    const courses = await listAriaCoursesForParentChild({
      actor: { userId: child.parentUser, role: 'PARENT' },
      studentId: child.student,
    });
    expect(courses).toContainEqual({
      courseKey: REAL_COURSE_KEY,
      label: expect.any(String),
    });
  });

  it('excludes a real course the child is academically enrolled in but has no ARIA entitlement scope for', async () => {
    const enrolledButNotEntitled = 'eds-nsi-premiere';
    await pool.query(
      `INSERT INTO student_academic_enrollments
       (id, "studentId", "courseKey", kind, source, "curriculumVersion", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'SPECIALTY', 'ADMIN', '2026-v1', NOW(), NOW())`,
      [randomUUID(), child.student, enrolledButNotEntitled],
    );
    const courses = await listAriaCoursesForParentChild({
      actor: { userId: child.parentUser, role: 'PARENT' },
      studentId: child.student,
    });
    expect(courses.some((entry) => entry.courseKey === enrolledButNotEntitled)).toBe(false);
    // The real entitled course is still correctly present alongside it.
    expect(courses.some((entry) => entry.courseKey === REAL_COURSE_KEY)).toBe(true);
  });

  it('rejects a parent trying to list a child from a different family (real cross-family isolation)', async () => {
    await expect(listAriaCoursesForParentChild({
      actor: { userId: otherFamily.parentUser, role: 'PARENT' },
      studentId: child.student,
    })).rejects.toThrow(AriaError);
  });

  it('rejects an ELEVE session', async () => {
    await expect(listAriaCoursesForParentChild({
      actor: { userId: child.parentUser, role: 'ELEVE' },
      studentId: child.student,
    })).rejects.toThrow(AriaError);
  });

  it('rejects a non-existent studentId with the same error as a real cross-family attempt (no existence leak)', async () => {
    await expect(listAriaCoursesForParentChild({
      actor: { userId: child.parentUser, role: 'PARENT' },
      studentId: 'not-a-real-student-id',
    })).rejects.toThrow(AriaError);
  });
});
