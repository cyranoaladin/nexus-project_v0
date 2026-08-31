import {
  planConversationContextBackfill,
  type LegacyContextEvidence,
} from '@/scripts/aria/backfill-conversation-context';

const row = {
  id: 'conversation-private-id',
  studentId: 'student-private-id',
  subject: 'MATHEMATIQUES',
  skillId: 'skill-v1',
  resourceId: null,
  courseKey: null,
  contextState: 'LEGACY_CONTEXT_UNRESOLVED',
};

function evidence(courseKey: string): LegacyContextEvidence {
  return {
    skillCourseCandidates: new Map([['skill-v1', [courseKey]]]),
    resourceCourseCandidates: new Map(),
    academicSubjectCandidates: new Map(),
  };
}

describe('ARIA conversation-context backfill planner', () => {
  it('B1_SNAPSHOT_BINDS_TARGET_RELEVANT_EVIDENCE_WITH_SAME_COUNTS', () => {
    const premiere = planConversationContextBackfill([row], evidence('eds-maths-premiere'));
    const terminale = planConversationContextBackfill([row], evidence('eds-maths-terminale'));
    const unrelatedEvidence: LegacyContextEvidence = {
      ...evidence('eds-maths-premiere'),
      skillCourseCandidates: new Map([
        ['skill-v1', ['eds-maths-premiere']],
        ['unrelated-skill', ['eds-nsi-terminale']],
      ]),
    };

    expect(premiere.report).toMatchObject({
      scanned: 1,
      deterministic: 1,
      archived: 0,
      manualReview: 0,
      mutated: 0,
    });
    expect(terminale.report).toMatchObject({
      scanned: premiere.report.scanned,
      deterministic: premiere.report.deterministic,
      archived: premiere.report.archived,
      manualReview: premiere.report.manualReview,
      mutated: premiere.report.mutated,
    });
    expect(terminale.sourceDigest).not.toBe(premiere.sourceDigest);
    expect(planConversationContextBackfill([row], unrelatedEvidence).sourceDigest)
      .toBe(premiere.sourceDigest);
    expect(JSON.stringify(premiere.sourceSnapshot)).not.toContain(row.studentId);
    expect(JSON.stringify(premiere.sourceSnapshot)).not.toContain(row.id);
  });

  it('binds row state and derived reason even when classification counters stay equal', () => {
    const academicEvidence: LegacyContextEvidence = {
      skillCourseCandidates: new Map(),
      resourceCourseCandidates: new Map(),
      academicSubjectCandidates: new Map([
        [`${row.studentId}:MATHEMATIQUES`, ['eds-maths-premiere']],
        [`${row.studentId}:PHYSIQUE_CHIMIE`, ['eds-physique-chimie-premiere']],
      ]),
    };
    const maths = planConversationContextBackfill([
      { ...row, skillId: null },
    ], academicEvidence);
    const physics = planConversationContextBackfill([
      { ...row, skillId: null, subject: 'PHYSIQUE_CHIMIE' },
    ], academicEvidence);

    expect(physics.report).toMatchObject({
      scanned: maths.report.scanned,
      deterministic: maths.report.deterministic,
      archived: maths.report.archived,
      manualReview: maths.report.manualReview,
      mutated: maths.report.mutated,
    });
    expect(physics.sourceDigest).not.toBe(maths.sourceDigest);
    expect(maths.decisions[0].decision.reasonCode).toBe('UNIQUE_ACADEMIC_SUBJECT');
  });

  it('B1_PLAN_DETACHES_AND_DEEPLY_FREEZES_ROWS_AND_DECISIONS', () => {
    const mutableRow = { ...row };
    const plan = planConversationContextBackfill([mutableRow], evidence('eds-maths-premiere'));
    mutableRow.subject = 'PHYSIQUE_CHIMIE';
    mutableRow.skillId = 'different-skill';

    expect(plan.decisions[0].row).toMatchObject({
      subject: 'MATHEMATIQUES',
      skillId: 'skill-v1',
    });
    expect(Object.isFrozen(plan.decisions)).toBe(true);
    expect(Object.isFrozen(plan.decisions[0])).toBe(true);
    expect(Object.isFrozen(plan.decisions[0].row)).toBe(true);
    expect(Object.isFrozen(plan.decisions[0].decision)).toBe(true);
    expect(plan.sourceDigest).toBe(plan.report.sourceDigest);
  });

  it('B1_SNAPSHOT_IGNORES_EVIDENCE_NOT_CONSULTED_BY_CLASSIFICATION', () => {
    const skillResolved = planConversationContextBackfill([row], evidence('eds-maths-premiere'));
    const skillWithUnusedAcademic = planConversationContextBackfill([row], {
      ...evidence('eds-maths-premiere'),
      academicSubjectCandidates: new Map([
        [`${row.studentId}:${row.subject}`, ['eds-nsi-terminale']],
      ]),
    });
    expect(skillWithUnusedAcademic.sourceDigest).toBe(skillResolved.sourceDigest);

    const existingCourse = { ...row, courseKey: 'eds-maths-premiere' };
    const existingWithoutEvidence = planConversationContextBackfill([existingCourse], {
      skillCourseCandidates: new Map(),
      resourceCourseCandidates: new Map(),
      academicSubjectCandidates: new Map(),
    });
    const existingWithUnusedEvidence = planConversationContextBackfill([existingCourse], {
      skillCourseCandidates: new Map([['skill-v1', ['eds-nsi-terminale']]]),
      resourceCourseCandidates: new Map([['resource-v1', ['eds-nsi-terminale']]]),
      academicSubjectCandidates: new Map([
        [`${row.studentId}:${row.subject}`, ['eds-nsi-terminale']],
      ]),
    });
    expect(existingWithUnusedEvidence.sourceDigest).toBe(existingWithoutEvidence.sourceDigest);

    const ambiguous = { ...row, skillId: 'ambiguous-skill' };
    const ambiguousEvidence: LegacyContextEvidence = {
      skillCourseCandidates: new Map([
        ['ambiguous-skill', ['eds-maths-premiere', 'eds-maths-terminale']],
      ]),
      resourceCourseCandidates: new Map(),
      academicSubjectCandidates: new Map(),
    };
    const ambiguousWithoutAcademic = planConversationContextBackfill([ambiguous], ambiguousEvidence);
    const ambiguousWithUnusedAcademic = planConversationContextBackfill([ambiguous], {
      ...ambiguousEvidence,
      academicSubjectCandidates: new Map([
        [`${row.studentId}:${row.subject}`, ['eds-maths-premiere']],
      ]),
    });
    expect(ambiguousWithUnusedAcademic.sourceDigest).toBe(ambiguousWithoutAcademic.sourceDigest);
  });
});
