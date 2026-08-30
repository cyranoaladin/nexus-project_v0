import { classifyLegacyConversationContext } from '@/scripts/aria/audit-legacy-data';
import { assertDisposableAriaBackfillTarget } from '@/scripts/aria/run-backfills';

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

  it('U019 ARIA-B-R017 quarantines colliding raw skill IDs and conflicting resource evidence', () => {
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

  it('accepts a unique academic-map candidate without relying on Subject defaults', () => {
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
});
