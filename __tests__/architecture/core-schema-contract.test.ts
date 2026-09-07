import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');

function block(kind: 'model' | 'enum', name: string): string {
  const match = schema.match(new RegExp(`${kind} ${name} \\{([\\s\\S]*?)\\n\\}`));
  expect(match).not.toBeNull();
  return match?.[1] ?? '';
}

describe('core family, academic assignment and planning schema contract', () => {
  test('models family requests as a lifecycle with structured children', () => {
    expect(block('enum', 'FamilyRequestType')).toMatch(/\bBILAN_GRATUIT\b[\s\S]*\bADD_CHILD\b/);
    expect(block('enum', 'FamilyRequestStatus')).toMatch(
      /\bSUBMITTED\b[\s\S]*\bQUALIFIED\b[\s\S]*\bIN_PROGRESS\b[\s\S]*\bCOMPLETED\b[\s\S]*\bREJECTED\b[\s\S]*\bCANCELLED\b/,
    );

    const request = block('model', 'FamilyRequest');
    expect(request).toMatch(/type\s+FamilyRequestType/);
    expect(request).toMatch(/status\s+FamilyRequestStatus\s+@default\(SUBMITTED\)/);
    expect(request).toMatch(/requestingParentProfileId\s+String\?/);
    expect(request).toMatch(/contactPhoneNormalized\s+String/);
    expect(request).toMatch(/consentAt\s+DateTime/);
    expect(request).toMatch(/children\s+FamilyRequestChild\[\]/);

    const child = block('model', 'FamilyRequestChild');
    expect(child).toMatch(/familyRequestId\s+String/);
    expect(child).toMatch(/familyRequest\s+FamilyRequest\s+@relation/);
    expect(child).toMatch(/firstName\s+String/);
    expect(child).toMatch(/lastName\s+String/);
    expect(child).toMatch(/gradeLevel\s+GradeLevel/);
    expect(child).toMatch(/academicCourseKeys\s+String\[\]\s+@default\(\[\]\)/);
  });

  test('adds optimistic academic revision and a non-destructive assignment course scope', () => {
    expect(block('model', 'Student')).toMatch(/academicRevision\s+Int\s+@default\(0\)/);

    const state = block('enum', 'AssignmentCourseScopeState');
    for (const value of [
      'STAFF_VERIFIED',
      'BACKFILL_AUTO',
      'BACKFILL_UNRESOLVED',
      'BACKFILL_AMBIGUOUS',
    ]) {
      expect(state).toMatch(new RegExp(`\\b${value}\\b`));
    }

    const assignment = block('model', 'CoachStudentAssignment');
    expect(assignment).toMatch(/subjects\s+Subject\[\]\s+@default\(\[\]\)/);
    expect(assignment).toMatch(/academicCourseKeys\s+String\[\]\s+@default\(\[\]\)/);
    expect(assignment).toMatch(
      /courseScopeState\s+AssignmentCourseScopeState\s+@default\(BACKFILL_UNRESOLVED\)/,
    );
  });

  test('models a canonical recurring planning series with domain profile ids', () => {
    const series = block('model', 'PlanningSeries');
    expect(series).toMatch(/studentProfileId\s+String/);
    expect(series).toMatch(/studentProfile\s+Student\s+@relation/);
    expect(series).toMatch(/coachProfileId\s+String/);
    expect(series).toMatch(/coachProfile\s+CoachProfile\s+@relation/);
    expect(series).toMatch(/assignmentId\s+String/);
    expect(series).toMatch(/assignment\s+CoachStudentAssignment\s+@relation/);
    expect(series).toMatch(/academicCourseKey\s+String/);
    expect(series).toMatch(/timezone\s+String\s+@default\("Africa\/Tunis"\)/);
    expect(series).toMatch(/startDate\s+DateTime\s+@db\.Date/);
    expect(series).toMatch(/localStartTime\s+String/);
    expect(series).toMatch(/localEndTime\s+String/);
    expect(series).toMatch(/recurrenceRule\s+String/);
    expect(series).toMatch(/recurrenceCount\s+Int\?/);
    expect(series).toMatch(/recurrenceUntil\s+DateTime\?\s+@db\.Date/);
    expect(series).toMatch(/modality\s+SessionModality/);
    expect(series).toMatch(/location\s+String\?/);
    expect(series).toMatch(/status\s+PlanningSeriesStatus\s+@default\(ACTIVE\)/);
    expect(series).toMatch(/revision\s+Int\s+@default\(0\)/);
    expect(series).toMatch(/createdById\s+String(?!\?)/);
    expect(series).toMatch(/createdBy\s+User\s+@relation\([^\n]*onDelete: Restrict/);
  });

  test('records every planning override in a dedicated audit relation', () => {
    const audit = block('model', 'PlanningOverrideAudit');
    expect(audit).toMatch(/sessionBookingId\s+String/);
    expect(audit).toMatch(/sessionBooking\s+SessionBooking\s+@relation\([^\n]*onDelete: Restrict/);
    expect(audit).toMatch(/planningSeriesId\s+String\?/);
    expect(audit).toMatch(/overrideCode\s+String/);
    expect(audit).toMatch(/overrideReason\s+String/);
    expect(audit).toMatch(/actorId\s+String/);
    expect(audit).toMatch(/actor\s+User\s+@relation\([^\n]*onDelete: Restrict/);
    expect(audit).toMatch(/occurredAt\s+DateTime\s+@default\(now\(\)\)/);
    expect(audit).toMatch(/previousValues\s+Json/);
    expect(audit).toMatch(/nextValues\s+Json/);

    expect(block('model', 'SessionBooking')).toMatch(/overrideAudits\s+PlanningOverrideAudit\[\]/);
    expect(block('model', 'PlanningSeries')).toMatch(/overrideAudits\s+PlanningOverrideAudit\[\]/);
    expect(block('model', 'User')).toMatch(/planningOverrideAudits\s+PlanningOverrideAudit\[\]/);
  });

  test('bridges bookings additively to canonical profiles, series and override audit', () => {
    const booking = block('model', 'SessionBooking');
    expect(booking).toMatch(/studentId\s+String/);
    expect(booking).toMatch(/coachId\s+String/);
    expect(booking).toMatch(/studentProfileId\s+String\?/);
    expect(booking).toMatch(/coachProfileId\s+String\?/);
    expect(booking).toMatch(/assignmentId\s+String\?/);
    expect(booking).toMatch(/academicCourseKey\s+String\?/);
    expect(booking).toMatch(/planningSeriesId\s+String\?/);
    expect(booking).toMatch(/occurrenceKey\s+String\?\s+@unique/);
    expect(booking).toMatch(/overridesBookingId\s+String\?\s+@unique/);
    expect(booking).toMatch(/overrideAudits\s+PlanningOverrideAudit\[\]/);
    expect(booking).not.toMatch(/overrideReason\s+String\?/);
    expect(booking).not.toMatch(/overrideCreatedById\s+String\?/);
    expect(booking).not.toMatch(/overrideCreatedAt\s+DateTime\?/);
  });

  test('binds every new relation from both sides and hashes idempotent payloads', () => {
    expect(block('model', 'User')).toMatch(/planningSeriesCreated\s+PlanningSeries\[\]/);
    expect(block('model', 'User')).toMatch(/planningOverrideAudits\s+PlanningOverrideAudit\[\]/);
    expect(block('model', 'User')).not.toMatch(/sessionBookingOverridesCreated\s+SessionBooking\[\]/);
    expect(block('model', 'ParentProfile')).toMatch(/familyRequests\s+FamilyRequest\[\]/);
    expect(block('model', 'Student')).toMatch(/planningSeries\s+PlanningSeries\[\]/);
    expect(block('model', 'Student')).toMatch(/canonicalSessionBookings\s+SessionBooking\[\]/);
    expect(block('model', 'CoachProfile')).toMatch(/planningSeries\s+PlanningSeries\[\]/);
    expect(block('model', 'CoachProfile')).toMatch(/canonicalSessionBookings\s+SessionBooking\[\]/);
    expect(block('model', 'CoachStudentAssignment')).toMatch(/planningSeries\s+PlanningSeries\[\]/);
    expect(block('model', 'CoachStudentAssignment')).toMatch(/sessionBookings\s+SessionBooking\[\]/);
    expect(block('model', 'CanonicalApiIdempotencyKey')).toMatch(/payloadHash\s+String\?/);
  });
});
