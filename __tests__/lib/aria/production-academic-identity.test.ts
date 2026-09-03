/**
 * P0-ARIA-01 — production RAG identity resolver.
 *
 * These tests pin the behaviour of `resolveProductionAriaRagIdentity`, the
 * server-truth-only counterpart to the E2E-only `resolveDisposableAriaRagIdentity`.
 *
 * Ground truth used throughout (verified against the repository at HEAD):
 * - `data/curriculum/v1/courses.json`: `eds-maths-terminale` and
 *   `eds-nsi-premiere` are `kind: "SPECIALTY"` with a `programmeSelector`
 *   `{subject, level, track, subjectVariant}`.
 * - `prisma/schema.prisma`: `GradeLevel`/`AcademicTrack` enums.
 * - `lib/curriculum/enrollment.ts`: a SPECIALTY course is only `ENROLLED`
 *   when a `StudentAcademicEnrollment` row exists — written exclusively by
 *   ADMIN/ASSISTANTE/SEED (never client-forgeable).
 * - RAG contract enums (`data/aria/generated/rag-contracts/v1/*.json`):
 *   `Candidat`, `Niveau`, `Voie`, `StatutEnseignement`, `Audience`.
 * - `lib/pricing.ts`'s `getOffersByAudience`/`getOffersByLevelAndAudience`
 *   have zero callers anywhere in the product (`grep -rln` across the repo):
 *   Nexus has no operational SSoT distinguishing an "aefe" vs "libre"
 *   audience segment per student today. This is the one dimension this
 *   resolver deliberately cannot construct — see ARIA_V1.md addendum.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { AcademicTrack, GradeLevel } from '@prisma/client';
import * as disposableIdentity from '@/lib/aria/infrastructure/rag/disposable-academic-identity';
import {
  resolveProductionAriaRagIdentity,
  resolveProductionAcademicVocabulary,
  resolveProductionCandidateStatus,
  resolveProductionAriaRagAudience,
  resolveProductionAriaRagPseudonym,
} from '@/lib/aria/infrastructure/rag/production-academic-identity';

const E2E_ENV_KEYS = [
  'E2E_DISPOSABLE_STACK',
  'ARIA_E2E_RAG_CANDIDAT',
  'ARIA_E2E_RAG_AUDIENCE',
  'ARIA_E2E_RAG_ZONE',
  'ARIA_E2E_RAG_STATUS_DETAIL',
] as const;

const PROD_SECRET = 'p'.repeat(32);

function baseEnv(overrides: Record<string, string | undefined> = {}) {
  const env: Record<string, string | undefined> = {};
  env.NEXUS_INTERNAL_TOKEN_SECRET = PROD_SECRET;
  for (const key of E2E_ENV_KEYS) env[key] = undefined;
  return { ...env, ...overrides };
}

function enrolledSpecialtyContext(overrides: Partial<{
  gradeLevel: GradeLevel;
  academicTrack: AcademicTrack;
  courseKey: string;
  enrolled: boolean;
}> = {}) {
  const courseKey = overrides.courseKey ?? 'eds-maths-terminale';
  const gradeLevel = overrides.gradeLevel ?? 'TERMINALE';
  const academicTrack = overrides.academicTrack ?? 'EDS_GENERALE';
  const enrolled = overrides.enrolled ?? true;
  return {
    courseKey,
    subject: { studentId: 'student-1' },
    student: {
      gradeLevel,
      academicTrack,
      academicEnrollments: enrolled
        ? [{ courseKey, kind: 'SPECIALTY' as const, source: 'ADMIN' as const }]
        : [],
    },
  };
}

function planFor(courseKey: string) {
  return {
    courseKey,
    academicYear: '2026-2027',
    retrievalScope: {},
  };
}

/**
 * A retrievalScope shaped exactly like a real, promoted servable-corpus
 * manifest's `target_policy` (`data/aria/generated/rag-contracts/v1/servable-corpus-manifest-v1.json`)
 * — this is what `resolveAriaRagCorpusCapability` loads onto
 * `AriaRetrievalPlan.retrievalScope` from the imported manifest, never
 * invented by this resolver (see `resolveProductionAriaRagAudience`).
 */
function planWithAudiences(courseKey: string, audiences: readonly string[]) {
  return {
    courseKey,
    academicYear: '2026-2027',
    retrievalScope: {
      target_policy: {
        tenant: 'nexus',
        niveau: 'terminale',
        voie: 'generale',
        matiere: 'mathematiques',
        statut_enseignement: 'specialite',
        candidates: ['scolarise'],
        audiences,
        roles: ['student'],
      },
      evidence_subject: {},
      scope_id: 'scope_test_1',
    },
  };
}

describe('P0-ARIA-01 — production RAG identity resolver', () => {
  const originalEnv = Object.fromEntries(
    [...E2E_ENV_KEYS, 'NEXUS_INTERNAL_TOKEN_SECRET'].map((key) => [key, process.env[key]]),
  );

  afterAll(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('exports a production resolver distinct from the disposable E2E one', () => {
    expect(typeof resolveProductionAriaRagIdentity).toBe('function');
    expect(resolveProductionAriaRagIdentity).not.toBe(disposableIdentity.resolveDisposableAriaRagIdentity);
  });

  it('CODEX_P0_ARIA_01_RED: a valid production config with zero E2E_* variables set still fails closed (no resolver could ever return an identity before this fix)', () => {
    const identity = resolveProductionAriaRagIdentity({
      context: enrolledSpecialtyContext(),
      plan: planFor('eds-maths-terminale'),
      environment: baseEnv(),
    });
    // Fails closed today because the `audience` dimension has no Nexus SSoT
    // (documented above) — this is an honest, permanent fail-closed, not a
    // "resolver doesn't exist" gap anymore.
    expect(identity).toBeNull();
  });

  it('never activates when E2E_DISPOSABLE_STACK=1 is set, even with otherwise-valid production data', () => {
    const identity = resolveProductionAriaRagIdentity({
      context: enrolledSpecialtyContext(),
      plan: planFor('eds-maths-terminale'),
      environment: baseEnv({ E2E_DISPOSABLE_STACK: '1' }),
    });
    expect(identity).toBeNull();
  });

  it('never reads ARIA_E2E_* variables (static source check — no substring match)', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'lib/aria/infrastructure/rag/production-academic-identity.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/ARIA_E2E_/);
  });

  it('does not read NEXUS_INTERNAL_TOKEN_SECRET below 32 bytes', () => {
    const identity = resolveProductionAriaRagIdentity({
      context: enrolledSpecialtyContext(),
      plan: planFor('eds-maths-terminale'),
      environment: baseEnv({ NEXUS_INTERNAL_TOKEN_SECRET: 'too-short' }),
    });
    expect(identity).toBeNull();
  });

  it('is also configuration-invalid when E2E_DISPOSABLE_STACK=1 AND the secret is short (both conditions fail together)', () => {
    const identity = resolveProductionAriaRagIdentity({
      context: enrolledSpecialtyContext(),
      plan: planFor('eds-maths-terminale'),
      environment: baseEnv({ E2E_DISPOSABLE_STACK: '1', NEXUS_INTERNAL_TOKEN_SECRET: 'too-short' }),
    });
    expect(identity).toBeNull();
  });

  it('fails closed when the requested courseKey does not match the resolved retrieval plan', () => {
    const identity = resolveProductionAriaRagIdentity({
      context: enrolledSpecialtyContext({ courseKey: 'eds-maths-terminale' }),
      plan: planFor('eds-nsi-terminale'),
      environment: baseEnv(),
    });
    expect(identity).toBeNull();
  });

  it('fails closed when the academic vocabulary cannot be resolved for the requested course (Physique-Chimie)', () => {
    const identity = resolveProductionAriaRagIdentity({
      context: enrolledSpecialtyContext({ courseKey: 'eds-physique-chimie-terminale' }),
      plan: planFor('eds-physique-chimie-terminale'),
      environment: baseEnv(),
    });
    expect(identity).toBeNull();
  });

  it('fails closed when the course is not backed by a verified enrollment (candidat cannot be asserted)', () => {
    const identity = resolveProductionAriaRagIdentity({
      context: enrolledSpecialtyContext({ enrolled: false }),
      plan: planFor('eds-maths-terminale'),
      environment: baseEnv(),
    });
    expect(identity).toBeNull();
  });

  it('fails closed when the retrieval plan carries no academicYear', () => {
    const identity = resolveProductionAriaRagIdentity({
      context: enrolledSpecialtyContext(),
      plan: { ...planFor('eds-maths-terminale'), academicYear: '' },
      environment: baseEnv(),
    });
    expect(identity).toBeNull();
  });

  describe('internal academic-vocabulary derivation (exported for direct, isolated testing)', () => {
    it('derives niveau/voie deterministically from GradeLevel/AcademicTrack for the four live chat courses', () => {
      expect(resolveProductionAcademicVocabulary({
        gradeLevel: 'TERMINALE', academicTrack: 'EDS_GENERALE', courseKey: 'eds-maths-terminale',
      })).toEqual({ niveau: 'terminale', voie: 'generale', matiere: 'mathematiques', statutEnseignement: 'specialite' });

      expect(resolveProductionAcademicVocabulary({
        gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE', courseKey: 'eds-nsi-premiere',
      })).toEqual({ niveau: 'premiere', voie: 'generale', matiere: 'nsi', statutEnseignement: 'specialite' });

      expect(resolveProductionAcademicVocabulary({
        gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE', courseKey: 'eds-maths-premiere',
      })).toEqual({ niveau: 'premiere', voie: 'generale', matiere: 'mathematiques', statutEnseignement: 'specialite' });

      expect(resolveProductionAcademicVocabulary({
        gradeLevel: 'TERMINALE', academicTrack: 'EDS_GENERALE', courseKey: 'eds-nsi-terminale',
      })).toEqual({ niveau: 'terminale', voie: 'generale', matiere: 'nsi', statutEnseignement: 'specialite' });
    });

    it('fails closed (null) for a grade level with no RAG Niveau mapping (POSTBAC/AUTRE)', () => {
      expect(resolveProductionAcademicVocabulary({
        gradeLevel: 'POSTBAC', academicTrack: 'EDS_GENERALE', courseKey: 'eds-maths-terminale',
      })).toBeNull();
      expect(resolveProductionAcademicVocabulary({
        gradeLevel: 'AUTRE', academicTrack: 'EDS_GENERALE', courseKey: 'eds-maths-terminale',
      })).toBeNull();
    });

    it('fails closed (null) for a course whose curriculum entry has no programmeSelector', () => {
      expect(resolveProductionAcademicVocabulary({
        gradeLevel: 'TERMINALE', academicTrack: 'EDS_GENERALE', courseKey: 'tc-philosophie-terminale',
      })).toBeNull();
    });

    it('fails closed (null) for a mismatched grade/track combination not present in the catalogue', () => {
      expect(resolveProductionAcademicVocabulary({
        gradeLevel: 'SECONDE', academicTrack: 'EDS_GENERALE', courseKey: 'eds-maths-terminale',
      })).toBeNull();
    });

    it('fails closed (null) for a real course whose subject has no RAG matiere mapping yet (Physique-Chimie)', () => {
      // eds-physique-chimie-terminale has a real programmeSelector
      // (subject: 'PHYSICS_CHEMISTRY') that MATIERE_BY_SUBJECT does not
      // cover — a genuine, currently-unmapped subject, not a fabricated one.
      expect(resolveProductionAcademicVocabulary({
        gradeLevel: 'TERMINALE', academicTrack: 'EDS_GENERALE', courseKey: 'eds-physique-chimie-terminale',
      })).toBeNull();
    });

    it('fails closed (null) for a real course whose subjectVariant has no RAG statutEnseignement mapping yet (Grand Oral)', () => {
      // tc-grand-oral-terminale's subjectVariant is 'TRANSVERSAL_EXPRESSION',
      // not covered by STATUT_ENSEIGNEMENT_BY_VARIANT (specialite/tronc_commun only).
      expect(resolveProductionAcademicVocabulary({
        gradeLevel: 'TERMINALE', academicTrack: 'EDS_GENERALE', courseKey: 'tc-grand-oral-terminale',
      })).toBeNull();
    });
  });

  describe('candidat=scolarise gate (verified enrollment only)', () => {
    it('never asserts candidat=scolarise for a course the student only has by grade/track derivation (DERIVED, not ENROLLED)', () => {
      expect(resolveProductionCandidateStatus({
        gradeLevel: 'TERMINALE',
        academicTrack: 'EDS_GENERALE',
        academicEnrollments: [],
      }, 'eds-maths-terminale')).toBeNull();
    });

    it('asserts candidat=scolarise only for a courseKey backed by a real StudentAcademicEnrollment row', () => {
      expect(resolveProductionCandidateStatus({
        gradeLevel: 'TERMINALE',
        academicTrack: 'EDS_GENERALE',
        academicEnrollments: [{ courseKey: 'eds-maths-terminale', kind: 'SPECIALTY', source: 'ADMIN' }],
      }, 'eds-maths-terminale')).toBe('scolarise');
    });

    it('does not leak across courses: an enrollment for another courseKey does not grant candidat=scolarise here', () => {
      expect(resolveProductionCandidateStatus({
        gradeLevel: 'TERMINALE',
        academicTrack: 'EDS_GENERALE',
        academicEnrollments: [{ courseKey: 'eds-nsi-terminale', kind: 'SPECIALTY', source: 'ADMIN' }],
      }, 'eds-maths-terminale')).toBeNull();
    });

    it('treats an omitted academicEnrollments field the same as an empty one (fails closed, never throws)', () => {
      expect(resolveProductionCandidateStatus({
        gradeLevel: 'TERMINALE',
        academicTrack: 'EDS_GENERALE',
        // academicEnrollments deliberately omitted, not just empty.
      }, 'eds-maths-terminale')).toBeNull();
    });

    it('CODEX_CUBIC_P2_RED: never asserts candidat=scolarise when the only matching enrollment is a BACKFILL_LEGACY_SPECIALTIES row (not staff-verified)', () => {
      // BACKFILL_LEGACY_SPECIALTIES rows are written by a one-off migration
      // script inferring specialties from legacy data, never by an
      // ADMIN/ASSISTANTE staff member and never SEED fixture data — the
      // module docstring's "never client-forgeable... verified record"
      // guarantee does not actually hold for this source (Cubic P2, conf 9).
      expect(resolveProductionCandidateStatus({
        gradeLevel: 'TERMINALE',
        academicTrack: 'EDS_GENERALE',
        academicEnrollments: [{
          courseKey: 'eds-maths-terminale',
          kind: 'SPECIALTY',
          source: 'BACKFILL_LEGACY_SPECIALTIES',
        }],
      }, 'eds-maths-terminale')).toBeNull();
    });

    it('still asserts candidat=scolarise when a staff-verified row coexists with an unrelated BACKFILL_LEGACY_SPECIALTIES row for a different course', () => {
      expect(resolveProductionCandidateStatus({
        gradeLevel: 'TERMINALE',
        academicTrack: 'EDS_GENERALE',
        academicEnrollments: [
          { courseKey: 'eds-nsi-terminale', kind: 'SPECIALTY', source: 'BACKFILL_LEGACY_SPECIALTIES' },
          { courseKey: 'eds-maths-terminale', kind: 'SPECIALTY', source: 'ADMIN' },
        ],
      }, 'eds-maths-terminale')).toBe('scolarise');
    });
  });

  describe('audience derivation from the manifest\'s own target_policy (closes the P0-ARIA-01 audience gap)', () => {
    it('CODEX_AUDIENCE_SSOT_RED: derives audience from a mono-audience corpus\'s own target_policy.audiences — the only value that could ever pass identityMatchesPlan()\'s own gate', () => {
      expect(resolveProductionAriaRagAudience({
        target_policy: { audiences: ['libre'] },
      })).toBe('libre');
      expect(resolveProductionAriaRagAudience({
        target_policy: { audiences: ['aefe'] },
      })).toBe('aefe');
    });

    it('fails closed (null) for a corpus declaring several SPECIFIC audiences — real per-student disambiguation would be required and Nexus has none', () => {
      expect(resolveProductionAriaRagAudience({
        target_policy: { audiences: ['aefe', 'libre'] },
      })).toBeNull();
    });

    it('resolves "tous" when it is the corpus\'s sole declared audience — an explicit "serves everyone" declaration, not an unresolved choice between populations', () => {
      expect(resolveProductionAriaRagAudience({
        target_policy: { audiences: ['tous'] },
      })).toBe('tous');
    });

    it('fails closed (null) for missing/malformed target_policy.audiences — never guessed', () => {
      expect(resolveProductionAriaRagAudience({ target_policy: {} })).toBeNull();
      expect(resolveProductionAriaRagAudience({ target_policy: { audiences: [] } })).toBeNull();
      expect(resolveProductionAriaRagAudience({ target_policy: { audiences: 'libre' } })).toBeNull();
      expect(resolveProductionAriaRagAudience({})).toBeNull();
    });

    it('CODEX_AUDIENCE_SSOT_RED: end-to-end — a mono-audience corpus now makes resolveProductionAriaRagIdentity return a REAL identity, not null', () => {
      const identity = resolveProductionAriaRagIdentity({
        context: enrolledSpecialtyContext(),
        plan: planWithAudiences('eds-maths-terminale', ['libre']),
        environment: baseEnv(),
      });
      expect(identity).not.toBeNull();
      expect(identity).toMatchObject({
        niveau: 'terminale',
        voie: 'generale',
        matiere: 'mathematiques',
        statutEnseignement: 'specialite',
        candidat: 'scolarise',
        audience: 'libre',
        schoolYear: '2026-2027',
        statusDetail: 'unknown',
      });
      expect(typeof identity!.zone).toBe('string');
      expect(identity!.zone.length).toBeGreaterThan(0);
      expect(identity!.pseudonymousSubject.startsWith('psn_')).toBe(true);
    });

    it('still fails closed end-to-end for a multi-audience corpus (real ambiguity, not a resolver bug)', () => {
      const identity = resolveProductionAriaRagIdentity({
        context: enrolledSpecialtyContext(),
        plan: planWithAudiences('eds-maths-terminale', ['aefe', 'libre']),
        environment: baseEnv(),
      });
      expect(identity).toBeNull();
    });
  });

  it('pseudonymises the subject deterministically and distinctly from the E2E prefix', () => {
    const a = resolveProductionAriaRagPseudonym('student-1', PROD_SECRET);
    const b = resolveProductionAriaRagPseudonym('student-1', PROD_SECRET);
    const c = resolveProductionAriaRagPseudonym('student-2', PROD_SECRET);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a.startsWith('psn_')).toBe(true);
  });
});
