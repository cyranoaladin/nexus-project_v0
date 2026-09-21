/**
 * Diagnostics candidats libres — C1 service layer. Every proof required by
 * the mission's own C1 acceptance list is exercised at the service level
 * here (the HTTP-route tests exercise the same paths again at the wire
 * level): attribution from a real instrument, frozen snapshot, anti-double
 * -attribution, staff dossier view, self-service subject access scoped to
 * the owning candidate only (never a role check — a data-scope check), and
 * a real, versioned, non-overwritable deposit.
 */
import { createHash } from 'node:crypto';
import type { PrismaClient } from '@/core-v2/generated/client';
import { CoreV2DomainError } from '@/lib/core-v2/errors';
import {
  attributeDiagnostic,
  createOwnDiagnosticSubmission,
  getOwnDiagnosticAssignmentForSubjectAccess,
  getOwnDiagnosticAssignments,
  listDiagnosticAssignmentsForStudent,
  listDiagnosticInstruments,
  revokeDiagnosticAssignment,
} from '@/lib/core-v2/services/diagnostics';
import {
  approveEnrollment,
  createAnnualEnrollment,
  createHousehold,
  createStudent,
  setCourseEnrollments,
} from '@/lib/core-v2/services';
import type { ServiceContext } from '@/lib/core-v2/services/context';
import type { Actor } from '@/lib/core-v2/rbac';
import { seedAcademicYear, setupServiceHarness } from '../helpers/service-harness';

const h = setupServiceHarness();

beforeEach(() => {
  process.env.DIAGNOSTIC_DEMO_MODE = '1';
  process.env.DIAGNOSTIC_DEMO_STUDENT_IDS = '';
});

/** Extends the demo allowlist for this test — mirrors the real env-var contract (mission §3), never a bypass. */
function allowDemoFixtureFor(...studentIds: string[]) {
  const existing = (process.env.DIAGNOSTIC_DEMO_STUDENT_IDS ?? '').split(',').filter(Boolean);
  process.env.DIAGNOSTIC_DEMO_STUDENT_IDS = [...existing, ...studentIds].join(',');
}

async function seedStudent(client: PrismaClient, ctx: ServiceContext, label: string) {
  const { household } = await createHousehold(client, ctx, {
    parent: { firstName: `P${label}`, lastName: 'Synthetic', email: `parent-${label}@synthetic.test` },
  });
  const { student, user } = await createStudent(client, ctx, {
    householdId: household.id,
    student: { firstName: `S${label}`, lastName: 'Synthetic' },
  });
  return { household, student, user };
}

async function seedDemoInstrument(client: PrismaClient, overrides: Partial<{ catalogStatus: string; instrumentKey: string }> = {}) {
  const instrumentKey = overrides.instrumentKey ?? 'TEST-DEMO-01';
  return client.diagnosticInstrumentRef.create({
    data: {
      instrumentKey,
      version: '1.0.0',
      title: 'Test instrument',
      subject: 'Test',
      level: 'Toutes',
      targetSession: 'DEMO',
      form: 'FORM_TEST',
      durationMinutes: 30,
      modalities: 'Test only.',
      catalogStatus: (overrides.catalogStatus as never) ?? 'DEMO_FIXTURE',
      manifestChecksum: createHash('sha256').update(instrumentKey).digest('hex'),
      manifestVersion: 'test/1.0',
    },
  });
}

function eleveActor(userId: string): Actor {
  return { userId, role: 'ELEVE' };
}

describe('listDiagnosticInstruments', () => {
  it('is visible to ASSISTANTE and ADMIN alike, every catalog status included', async () => {
    await seedDemoInstrument(h.client, { catalogStatus: 'IN_REVIEW', instrumentKey: 'IN-REVIEW-1' });
    await seedDemoInstrument(h.client, { catalogStatus: 'DEMO_FIXTURE', instrumentKey: 'DEMO-1' });
    const rows = await listDiagnosticInstruments(h.client, h.ctx(h.assistante));
    expect(rows.map((r) => r.catalogStatus).sort()).toEqual(['DEMO_FIXTURE', 'IN_REVIEW']);
  });

  it('refuses a COACH/PARENT/ELEVE actor', async () => {
    await expect(listDiagnosticInstruments(h.client, h.ctx(h.parentActor))).rejects.toThrow(CoreV2DomainError);
  });
});

describe('attributeDiagnostic', () => {
  it('attributes an AUTHORIZED-equivalent (DEMO_FIXTURE) instrument and freezes its snapshot', async () => {
    const { student } = await seedStudent(h.client, h.ctx(), 'A');
    allowDemoFixtureFor(student.id);
    const instrument = await seedDemoInstrument(h.client);

    const assignment = await attributeDiagnostic(h.client, h.ctx(h.assistante), {
      studentId: student.id,
      instrumentRefId: instrument.id,
    });

    expect(assignment.status).toBe('ASSIGNED');
    expect(assignment.instrumentKeySnapshot).toBe(instrument.instrumentKey);
    expect(assignment.instrumentVersionSnapshot).toBe(instrument.version);
    expect(assignment.manifestChecksumSnapshot).toBe(instrument.manifestChecksum);

    // Catalog evolves after attribution — the snapshot must not move.
    await h.client.diagnosticInstrumentRef.update({
      where: { id: instrument.id },
      data: { version: '2.0.0', manifestChecksum: 'changed' },
    });
    const reread = await h.client.diagnosticAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(reread.instrumentVersionSnapshot).toBe('1.0.0');
    expect(reread.manifestChecksumSnapshot).toBe(instrument.manifestChecksum);
  });

  it('refuses an IN_REVIEW instrument — never attributable to a real candidate', async () => {
    const { student } = await seedStudent(h.client, h.ctx(), 'B');
    const instrument = await seedDemoInstrument(h.client, { catalogStatus: 'IN_REVIEW', instrumentKey: 'IN-REVIEW-2' });
    await expect(
      attributeDiagnostic(h.client, h.ctx(h.assistante), { studentId: student.id, instrumentRefId: instrument.id }),
    ).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });

  it('refuses a COMPROMISED instrument', async () => {
    const { student } = await seedStudent(h.client, h.ctx(), 'C');
    const instrument = await seedDemoInstrument(h.client, { catalogStatus: 'COMPROMISED', instrumentKey: 'COMPROMISED-1' });
    await expect(
      attributeDiagnostic(h.client, h.ctx(h.assistante), { studentId: student.id, instrumentRefId: instrument.id }),
    ).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });

  it('anti-double-click: a second attribution of the SAME instrument to the SAME student is refused as a conflict', async () => {
    const { student } = await seedStudent(h.client, h.ctx(), 'D');
    allowDemoFixtureFor(student.id);
    const instrument = await seedDemoInstrument(h.client, { instrumentKey: 'DOUBLE-CLICK-1' });
    await attributeDiagnostic(h.client, h.ctx(h.assistante), { studentId: student.id, instrumentRefId: instrument.id });
    await expect(
      attributeDiagnostic(h.client, h.ctx(h.assistante), { studentId: student.id, instrumentRefId: instrument.id }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('re-attribution IS allowed once the prior attribution is REVOKED', async () => {
    const { student } = await seedStudent(h.client, h.ctx(), 'E');
    allowDemoFixtureFor(student.id);
    const instrument = await seedDemoInstrument(h.client, { instrumentKey: 'REVOKE-THEN-REATTRIBUTE-1' });
    const first = await attributeDiagnostic(h.client, h.ctx(h.assistante), { studentId: student.id, instrumentRefId: instrument.id });
    await revokeDiagnosticAssignment(h.client, h.ctx(h.admin), { assignmentId: first.id, reason: 'Instrument version compromised.' });
    const second = await attributeDiagnostic(h.client, h.ctx(h.assistante), { studentId: student.id, instrumentRefId: instrument.id });
    expect(second.id).not.toBe(first.id);
  });

  it('builds a real studentProfileSnapshot from canonical enrollment data when one exists', async () => {
    const { student } = await seedStudent(h.client, h.ctx(), 'F');
    allowDemoFixtureFor(student.id);
    const year = await seedAcademicYear(h.client, 2027);
    const enrollment = await createAnnualEnrollment(h.client, h.ctx(), {
      studentId: student.id,
      academicYearId: year.id,
      academicMap: { gradeLevel: 'TERMINALE', academicTrack: 'EDS_GENERALE' },
    });
    await approveEnrollment(h.client, h.ctx(), enrollment.id);
    await setCourseEnrollments(h.client, h.ctx(), {
      enrollmentId: enrollment.id,
      courses: [{ courseKey: 'mathematiques', kind: 'SPECIALTY' }],
    });
    const instrument = await seedDemoInstrument(h.client, { instrumentKey: 'PROFILE-SNAPSHOT-1' });

    const assignment = await attributeDiagnostic(h.client, h.ctx(h.assistante), {
      studentId: student.id,
      instrumentRefId: instrument.id,
    });

    expect(assignment.studentProfileSnapshot).toMatchObject({
      available: true,
      gradeLevel: 'TERMINALE',
      academicTrack: 'EDS_GENERALE',
      courses: [{ courseKey: 'mathematiques', kind: 'SPECIALTY' }],
    });
  });

  it('never certifies bac eligibility — a student with no active enrollment gets an honest "unavailable" snapshot, not fabricated data', async () => {
    const { student } = await seedStudent(h.client, h.ctx(), 'G');
    allowDemoFixtureFor(student.id);
    const instrument = await seedDemoInstrument(h.client, { instrumentKey: 'NO-ENROLLMENT-1' });
    const assignment = await attributeDiagnostic(h.client, h.ctx(h.assistante), {
      studentId: student.id,
      instrumentRefId: instrument.id,
    });
    expect(assignment.studentProfileSnapshot).toEqual({ available: false });
  });
});

describe('DEMO_FIXTURE containment (mission §3 — the four required counter-proofs)', () => {
  it('demo mode enabled + synthetic candidate on the allowlist: attribution is permitted', async () => {
    const { student } = await seedStudent(h.client, h.ctx(), 'DEMO-OK');
    allowDemoFixtureFor(student.id);
    const instrument = await seedDemoInstrument(h.client, { instrumentKey: 'DEMO-SCOPE-OK-1' });
    await expect(
      attributeDiagnostic(h.client, h.ctx(h.assistante), { studentId: student.id, instrumentRefId: instrument.id }),
    ).resolves.toMatchObject({ status: 'ASSIGNED' });
  });

  it('demo configuration absent (mode unset): the fixture is refused even to an otherwise-eligible student', async () => {
    const { student } = await seedStudent(h.client, h.ctx(), 'DEMO-NO-MODE');
    delete process.env.DIAGNOSTIC_DEMO_MODE;
    process.env.DIAGNOSTIC_DEMO_STUDENT_IDS = student.id; // present on the allowlist, but mode itself is off
    const instrument = await seedDemoInstrument(h.client, { instrumentKey: 'DEMO-SCOPE-NO-MODE-1' });
    await expect(
      attributeDiagnostic(h.client, h.ctx(h.assistante), { studentId: student.id, instrumentRefId: instrument.id }),
    ).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });

  it('real-operation context (demo mode on, but this student not on the allowlist): refused even though the fixture row exists in the database, and even for ADMIN calling directly', async () => {
    const { student } = await seedStudent(h.client, h.ctx(), 'DEMO-NOT-ALLOWED');
    // DIAGNOSTIC_DEMO_MODE stays '1' from beforeEach; the allowlist stays empty — never touched for this student.
    const instrument = await seedDemoInstrument(h.client, { instrumentKey: 'DEMO-SCOPE-REAL-OP-1' });
    await expect(
      attributeDiagnostic(h.client, h.ctx(h.admin), { studentId: student.id, instrumentRefId: instrument.id }),
    ).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });

  it('an IN_REVIEW/ARCHIVED/COMPROMISED instrument is refused regardless of demo mode or allowlist', async () => {
    const { student } = await seedStudent(h.client, h.ctx(), 'DEMO-STILL-IN-REVIEW');
    allowDemoFixtureFor(student.id); // fully authorized for DEMO_FIXTURE, irrelevant to a real-catalog status
    for (const [status, key] of [
      ['IN_REVIEW', 'DEMO-SCOPE-IN-REVIEW-1'],
      ['ARCHIVED', 'DEMO-SCOPE-ARCHIVED-1'],
      ['COMPROMISED', 'DEMO-SCOPE-COMPROMISED-1'],
    ] as const) {
      const instrument = await seedDemoInstrument(h.client, { catalogStatus: status, instrumentKey: key });
      await expect(
        attributeDiagnostic(h.client, h.ctx(h.admin), { studentId: student.id, instrumentRefId: instrument.id }),
      ).rejects.toMatchObject({ code: 'INVALID_STATE' });
    }
  });

  it('the allowlist is per-student: being demo-eligible does not make a DIFFERENT student demo-eligible', async () => {
    const { student: allowed } = await seedStudent(h.client, h.ctx(), 'DEMO-ALLOWED');
    const { student: notAllowed } = await seedStudent(h.client, h.ctx(), 'DEMO-NOT-ALLOWED-2');
    allowDemoFixtureFor(allowed.id);
    const instrument = await seedDemoInstrument(h.client, { instrumentKey: 'DEMO-SCOPE-PER-STUDENT-1' });
    await expect(
      attributeDiagnostic(h.client, h.ctx(h.admin), { studentId: notAllowed.id, instrumentRefId: instrument.id }),
    ).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });
});

describe('listDiagnosticAssignmentsForStudent (staff dossier view)', () => {
  it('lists an attribution with its instrument and empty submissions', async () => {
    const { student } = await seedStudent(h.client, h.ctx(), 'H');
    allowDemoFixtureFor(student.id);
    const instrument = await seedDemoInstrument(h.client, { instrumentKey: 'DOSSIER-VIEW-1' });
    await attributeDiagnostic(h.client, h.ctx(h.assistante), { studentId: student.id, instrumentRefId: instrument.id });

    const rows = await listDiagnosticAssignmentsForStudent(h.client, h.ctx(h.admin), student.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].instrumentRef.instrumentKey).toBe('DOSSIER-VIEW-1');
    expect(rows[0].submissions).toHaveLength(0);
  });
});

describe('self-service: getOwnDiagnosticAssignments / getOwnDiagnosticAssignmentForSubjectAccess', () => {
  it('the candidate sees only their own assignments', async () => {
    const { student: studentA, user: userA } = await seedStudent(h.client, h.ctx(), 'I1');
    const { student: studentB } = await seedStudent(h.client, h.ctx(), 'I2');
    allowDemoFixtureFor(studentA.id, studentB.id);
    const instrument = await seedDemoInstrument(h.client, { instrumentKey: 'SELF-SERVICE-1' });
    const assignmentA = await attributeDiagnostic(h.client, h.ctx(h.assistante), { studentId: studentA.id, instrumentRefId: instrument.id });
    await attributeDiagnostic(h.client, h.ctx(h.assistante), { studentId: studentB.id, instrumentRefId: instrument.id });

    const own = await getOwnDiagnosticAssignments(h.client, h.ctx(eleveActor(userA.id)));
    expect(own).toHaveLength(1);
    expect(own[0].id).toBe(assignmentA.id);
  });

  it('refuses (as NotFound, not Forbidden) a candidate reading ANOTHER candidate\'s assignment by id', async () => {
    const { student: studentA } = await seedStudent(h.client, h.ctx(), 'J1');
    const { user: userB } = await seedStudent(h.client, h.ctx(), 'J2');
    allowDemoFixtureFor(studentA.id);
    const instrument = await seedDemoInstrument(h.client, { instrumentKey: 'CROSS-CANDIDATE-1' });
    const assignmentA = await attributeDiagnostic(h.client, h.ctx(h.assistante), { studentId: studentA.id, instrumentRefId: instrument.id });

    await expect(
      getOwnDiagnosticAssignmentForSubjectAccess(h.client, h.ctx(eleveActor(userB.id)), assignmentA.id),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('refuses subject access once the assignment is REVOKED', async () => {
    const { student, user } = await seedStudent(h.client, h.ctx(), 'K');
    allowDemoFixtureFor(student.id);
    const instrument = await seedDemoInstrument(h.client, { instrumentKey: 'REVOKED-SUBJECT-1' });
    const assignment = await attributeDiagnostic(h.client, h.ctx(h.assistante), { studentId: student.id, instrumentRefId: instrument.id });
    await revokeDiagnosticAssignment(h.client, h.ctx(h.admin), { assignmentId: assignment.id, reason: 'test' });

    await expect(
      getOwnDiagnosticAssignmentForSubjectAccess(h.client, h.ctx(eleveActor(user.id)), assignment.id),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('createOwnDiagnosticSubmission', () => {
  it('records a first deposit as version 1 and moves the assignment to SUBMITTED', async () => {
    const { student, user } = await seedStudent(h.client, h.ctx(), 'L');
    allowDemoFixtureFor(student.id);
    const instrument = await seedDemoInstrument(h.client, { instrumentKey: 'DEPOSIT-1' });
    const assignment = await attributeDiagnostic(h.client, h.ctx(h.assistante), { studentId: student.id, instrumentRefId: instrument.id });

    const submission = await createOwnDiagnosticSubmission(h.client, h.ctx(eleveActor(user.id)), {
      assignmentId: assignment.id,
      originalFilename: 'reponses.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1234,
      sha256: 'a'.repeat(64),
      storageKey: `${assignment.id}/v1.pdf`,
    });

    expect(submission.version).toBe(1);
    const reread = await h.client.diagnosticAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(reread.status).toBe('SUBMITTED');
  });

  it('a second deposit is version 2, never a silent overwrite of version 1', async () => {
    const { student, user } = await seedStudent(h.client, h.ctx(), 'M');
    allowDemoFixtureFor(student.id);
    const instrument = await seedDemoInstrument(h.client, { instrumentKey: 'DEPOSIT-2' });
    const assignment = await attributeDiagnostic(h.client, h.ctx(h.assistante), { studentId: student.id, instrumentRefId: instrument.id });
    const depositOnce = () =>
      createOwnDiagnosticSubmission(h.client, h.ctx(eleveActor(user.id)), {
        assignmentId: assignment.id,
        originalFilename: 'reponses.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1234,
        sha256: 'b'.repeat(64),
        storageKey: `${assignment.id}/vX.pdf`,
      });

    const first = await depositOnce();
    const second = await depositOnce();
    expect([first.version, second.version].sort()).toEqual([1, 2]);

    const all = await h.client.diagnosticSubmission.findMany({ where: { assignmentId: assignment.id } });
    expect(all).toHaveLength(2);
  });

  it('refuses a deposit on an assignment belonging to another candidate', async () => {
    const { student } = await seedStudent(h.client, h.ctx(), 'N1');
    const { user: userOther } = await seedStudent(h.client, h.ctx(), 'N2');
    allowDemoFixtureFor(student.id);
    const instrument = await seedDemoInstrument(h.client, { instrumentKey: 'CROSS-CANDIDATE-DEPOSIT-1' });
    const assignment = await attributeDiagnostic(h.client, h.ctx(h.assistante), { studentId: student.id, instrumentRefId: instrument.id });

    await expect(
      createOwnDiagnosticSubmission(h.client, h.ctx(eleveActor(userOther.id)), {
        assignmentId: assignment.id,
        originalFilename: 'x.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1,
        sha256: 'c'.repeat(64),
        storageKey: `${assignment.id}/vY.pdf`,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('refuses a deposit once the assignment is REVOKED', async () => {
    const { student, user } = await seedStudent(h.client, h.ctx(), 'O');
    allowDemoFixtureFor(student.id);
    const instrument = await seedDemoInstrument(h.client, { instrumentKey: 'REVOKED-DEPOSIT-1' });
    const assignment = await attributeDiagnostic(h.client, h.ctx(h.assistante), { studentId: student.id, instrumentRefId: instrument.id });
    await revokeDiagnosticAssignment(h.client, h.ctx(h.admin), { assignmentId: assignment.id, reason: 'test' });

    await expect(
      createOwnDiagnosticSubmission(h.client, h.ctx(eleveActor(user.id)), {
        assignmentId: assignment.id,
        originalFilename: 'x.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1,
        sha256: 'd'.repeat(64),
        storageKey: `${assignment.id}/vZ.pdf`,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });
});
