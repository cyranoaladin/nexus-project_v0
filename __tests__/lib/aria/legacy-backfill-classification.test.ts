import { classifyLegacyConversationContext } from '@/scripts/aria/audit-legacy-data';
import { assertDisposableAriaBackfillTarget } from '@/scripts/aria/backfill-safety';

const base = {
  id: 'conversation-1',
  studentId: 'student-1',
  subject: 'MATHEMATIQUES',
  skillId: null,
  resourceId: null,
  courseKey: null,
  contextState: 'LEGACY_CONTEXT_UNRESOLVED',
};

describe('ARIA legacy context classification', () => {
  it('refuses absent, production-like and unmarked backfill targets', () => {
    const authority = `${['placeholder', 'placeholder'].join(':')}@`;
    expect(() => assertDisposableAriaBackfillTarget(undefined, '1')).toThrow(
      'ARIA_BACKFILL_DATABASE_NOT_DISPOSABLE',
    );
    expect(() => assertDisposableAriaBackfillTarget(
      `postgresql://${authority}db.internal:5432/nexus_production`,
      '1',
    )).toThrow('ARIA_BACKFILL_DATABASE_NOT_DISPOSABLE');
    expect(() => assertDisposableAriaBackfillTarget(
      `postgresql://${authority}127.0.0.1:49123/nexus_disposable_aria_deadbeef_test`,
      undefined,
    )).toThrow('ARIA_BACKFILL_DATABASE_NOT_DISPOSABLE');
  });

  it('U018 ARIA-B-R003 does not invent a grade or course for a subject-only Seconde-era row', () => {
    expect(classifyLegacyConversationContext(base, {
      skillCourseCandidates: new Map(),
      resourceCourseCandidates: new Map(),
      academicSubjectCandidates: new Map(),
    })).toEqual({
      classification: 'ARCHIVED_NON_RESUMABLE',
      courseKey: null,
      reasonCode: 'NO_PROVABLE_CONTEXT',
    });
  });

  it.each([
    ['ARIA-B-R001 Première Maths uses the unique explicit Academic Map evidence', 'eds-maths-premiere'],
    ['ARIA-B-R002 Terminale Maths uses the unique explicit Academic Map evidence', 'eds-maths-terminale'],
  ] as const)('%s', (_title, courseKey) => {
    expect(classifyLegacyConversationContext(base, {
      skillCourseCandidates: new Map(),
      resourceCourseCandidates: new Map(),
      academicSubjectCandidates: new Map([
        ['student-1:MATHEMATIQUES', [courseKey]],
      ]),
    })).toEqual({
      classification: 'DETERMINISTIC_BACKFILL',
      courseKey,
      reasonCode: 'UNIQUE_ACADEMIC_SUBJECT',
    });
  });

  it('ARIA-B-R004 archives an unsupported legacy subject without inventing a course', () => {
    expect(classifyLegacyConversationContext({ ...base, subject: 'ALLEMAND' }, {
      skillCourseCandidates: new Map(),
      resourceCourseCandidates: new Map(),
      academicSubjectCandidates: new Map(),
    })).toMatchObject({ classification: 'ARCHIVED_NON_RESUMABLE', courseKey: null });
  });

  it('ARIA-B-R005 has no grade default when no canonical evidence supplies a course', () => {
    expect(classifyLegacyConversationContext(base, {
      skillCourseCandidates: new Map(),
      resourceCourseCandidates: new Map(),
      academicSubjectCandidates: new Map(),
    })).not.toHaveProperty('gradeLevel');
  });

  it('ARIA-B-R006 keeps a null legacy subject archived instead of mapping it to Maths', () => {
    expect(classifyLegacyConversationContext({ ...base, subject: null }, {
      skillCourseCandidates: new Map(),
      resourceCourseCandidates: new Map(),
      academicSubjectCandidates: new Map(),
    })).toEqual({
      classification: 'ARCHIVED_NON_RESUMABLE', courseKey: null, reasonCode: 'NO_PROVABLE_CONTEXT',
    });
  });

  it('B1 quarantines colliding raw skill IDs and conflicting resource evidence', () => {
    expect(classifyLegacyConversationContext(
      { ...base, skillId: 'derivee', resourceId: 'resource-1' },
      {
        skillCourseCandidates: new Map([
          ['derivee', ['eds-maths-premiere', 'eds-maths-terminale']],
        ]),
        resourceCourseCandidates: new Map([
          ['resource-1', ['eds-maths-premiere']],
        ]),
        academicSubjectCandidates: new Map(),
      },
    ).classification).toBe('MANUAL_REVIEW_REQUIRED');
  });

  it('ARIA-B-R014 backfills only from one exact canonical ResourceVersion course', () => {
    expect(classifyLegacyConversationContext({ ...base, resourceId: 'resource-version-1' }, {
      skillCourseCandidates: new Map(),
      resourceCourseCandidates: new Map([['resource-version-1', ['eds-maths-premiere']]]),
      academicSubjectCandidates: new Map(),
    })).toMatchObject({
      classification: 'DETERMINISTIC_BACKFILL', courseKey: 'eds-maths-premiere',
      reasonCode: 'UNIQUE_CANONICAL_EVIDENCE',
    });
  });

  it('ARIA-B-R015 backfills only from one exact canonical Skill course', () => {
    expect(classifyLegacyConversationContext({ ...base, skillId: 'skill-version-1' }, {
      skillCourseCandidates: new Map([['skill-version-1', ['eds-maths-terminale']]]),
      resourceCourseCandidates: new Map(),
      academicSubjectCandidates: new Map(),
    })).toMatchObject({
      classification: 'DETERMINISTIC_BACKFILL', courseKey: 'eds-maths-terminale',
      reasonCode: 'UNIQUE_CANONICAL_EVIDENCE',
    });
  });

  it('ARIA-B-R016 accepts a unique academic-map candidate without relying on Subject defaults', () => {
    expect(classifyLegacyConversationContext(base, {
      skillCourseCandidates: new Map(),
      resourceCourseCandidates: new Map(),
      academicSubjectCandidates: new Map([
        ['student-1:MATHEMATIQUES', ['eds-maths-premiere']],
      ]),
    })).toEqual({
      classification: 'DETERMINISTIC_BACKFILL',
      courseKey: 'eds-maths-premiere',
      reasonCode: 'UNIQUE_ACADEMIC_SUBJECT',
    });
  });

  it('ARIA-B-R018 sends an unknown stored courseKey to manual review', () => {
    expect(classifyLegacyConversationContext({ ...base, courseKey: 'unknown-course' }, {
      skillCourseCandidates: new Map(),
      resourceCourseCandidates: new Map(),
      academicSubjectCandidates: new Map(),
    })).toEqual({
      classification: 'MANUAL_REVIEW_REQUIRED',
      courseKey: null,
      reasonCode: 'INVALID_EXISTING_COURSE',
    });
  });
});
