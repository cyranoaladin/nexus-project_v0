import fixture from '@/data/aria/generated/rag-contracts/v1/fixtures/internal-identity-envelope-v1.json';
import { resolveDisposableAriaRagIdentity } from '@/lib/aria/infrastructure/rag/disposable-academic-identity';

const plan = Object.freeze({
  courseKey: 'eds-maths-premiere',
  retrievalScope: fixture.retrievalScope,
});

const context = Object.freeze({
  courseKey: 'eds-maths-premiere',
  subject: Object.freeze({ studentId: 'student-database-id-must-not-leak' }),
});

const disposableEnvironment = Object.freeze({
  E2E_DISPOSABLE_STACK: '1',
  NEXUS_INTERNAL_TOKEN_SECRET: 'k'.repeat(32),
  ARIA_E2E_RAG_CANDIDAT: 'scolarise',
  ARIA_E2E_RAG_AUDIENCE: 'aefe',
  ARIA_E2E_RAG_ZONE: 'aefe',
  ARIA_E2E_RAG_STATUS_DETAIL: 'aefe',
});

describe('ARIA disposable RAG academic identity adapter', () => {
  it('stays disabled outside the explicitly disposable stack', () => {
    expect(resolveDisposableAriaRagIdentity({
      context,
      plan,
      environment: { ...disposableEnvironment, E2E_DISPOSABLE_STACK: '0' },
    })).toBeNull();
  });

  it('derives a pseudonymous fixture identity from the verified manifest scope', () => {
    const identity = resolveDisposableAriaRagIdentity({
      context,
      plan,
      environment: disposableEnvironment,
    });
    expect(identity).toMatchObject({
      niveau: 'premiere',
      voie: 'generale',
      matiere: 'mathematiques',
      statutEnseignement: 'specialite',
      candidat: 'scolarise',
      audience: 'aefe',
      schoolYear: '2026-2027',
    });
    expect(identity?.pseudonymousSubject).toMatch(/^psn_[0-9a-f]{32}$/);
    expect(identity?.pseudonymousSubject).not.toContain(context.subject.studentId);
  });

  it('fails closed when the fixture candidate, audience, course, or key violates the scope', () => {
    for (const candidate of [
      { environment: { ...disposableEnvironment, ARIA_E2E_RAG_CANDIDAT: 'unknown' } },
      { environment: { ...disposableEnvironment, ARIA_E2E_RAG_AUDIENCE: 'unknown' } },
      { environment: { ...disposableEnvironment, NEXUS_INTERNAL_TOKEN_SECRET: 'short' } },
      { context: { ...context, courseKey: 'eds-nsi-premiere' } },
    ]) {
      expect(resolveDisposableAriaRagIdentity({
        context: candidate.context ?? context,
        plan,
        environment: candidate.environment ?? disposableEnvironment,
      })).toBeNull();
    }
  });

  it('fails closed when disposable identity configuration is incomplete', () => {
    expect(resolveDisposableAriaRagIdentity({ context, plan })).toBeNull();
    for (const key of [
      'NEXUS_INTERNAL_TOKEN_SECRET',
      'ARIA_E2E_RAG_CANDIDAT',
      'ARIA_E2E_RAG_AUDIENCE',
      'ARIA_E2E_RAG_ZONE',
      'ARIA_E2E_RAG_STATUS_DETAIL',
    ] as const) {
      expect(resolveDisposableAriaRagIdentity({
        context,
        plan,
        environment: { ...disposableEnvironment, [key]: undefined },
      })).toBeNull();
    }
  });

  it.each([
    ['MISSING_TARGET', { ...plan, retrievalScope: { ...plan.retrievalScope, target_policy: null } }],
    ['ARRAY_TARGET', { ...plan, retrievalScope: { ...plan.retrievalScope, target_policy: [] } }],
    ['MISSING_EVIDENCE', { ...plan, retrievalScope: { ...plan.retrievalScope, evidence_subject: null } }],
    ['NON_ARRAY_CANDIDATES', {
      ...plan,
      retrievalScope: {
        ...plan.retrievalScope,
        target_policy: { ...plan.retrievalScope.target_policy, candidates: 'scolarise' },
      },
    }],
    ['NON_ARRAY_AUDIENCES', {
      ...plan,
      retrievalScope: {
        ...plan.retrievalScope,
        target_policy: { ...plan.retrievalScope.target_policy, audiences: 'aefe' },
      },
    }],
  ])('fails closed for malformed retrieval scope %s', (_name, malformedPlan) => {
    expect(resolveDisposableAriaRagIdentity({
      context,
      plan: malformedPlan,
      environment: disposableEnvironment,
    })).toBeNull();
  });

  it.each([
    ['EMPTY_LEVEL', 'niveau', ''],
    ['NON_STRING_TRACK', 'voie', 42],
    ['MISSING_SUBJECT', 'matiere', undefined],
    ['MISSING_ENROLLMENT_STATUS', 'statut_enseignement', null],
  ])('fails closed for invalid target dimension %s', (_name, field, value) => {
    expect(resolveDisposableAriaRagIdentity({
      context,
      plan: {
        ...plan,
        retrievalScope: {
          ...plan.retrievalScope,
          target_policy: { ...plan.retrievalScope.target_policy, [field]: value },
        },
      },
      environment: disposableEnvironment,
    })).toBeNull();
  });

  it.each([
    ['MISSING_SCHOOL_YEAR', { school_year: '' }],
    ['LEVEL_MISMATCH', { niveau: 'terminale' }],
    ['TRACK_MISMATCH', { voie: 'technologique' }],
    ['SUBJECT_MISMATCH', { matiere: 'nsi' }],
    ['ENROLLMENT_STATUS_MISMATCH', { statut_enseignement: 'obligatoire' }],
  ])('fails closed for evidence mismatch %s', (_name, evidencePatch) => {
    expect(resolveDisposableAriaRagIdentity({
      context,
      plan: {
        ...plan,
        retrievalScope: {
          ...plan.retrievalScope,
          evidence_subject: { ...plan.retrievalScope.evidence_subject, ...evidencePatch },
        },
      },
      environment: disposableEnvironment,
    })).toBeNull();
  });
});
