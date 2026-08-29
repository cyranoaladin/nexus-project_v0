/**
 * T18 — Exam-rules canonical data (mission CDC §11/§12/§60).
 *
 * Protects the regulatory backbone of the quote engine: coefficients sum
 * correctly, unknown sessions fail closed, and — the single most important
 * invariant of this whole domain — "ponctuelles regroupées en fin de cycle"
 * is never conflated with "Bac en un an" / same-session eligibility.
 */
import {
  getExamPolicy,
  requireExamPolicy,
  getSupportedSessions,
  getEpreuve,
  checkSameSessionEligibility,
} from '@/lib/exams/catalog';
import { examPolicySchema } from '@/lib/exams/schema';
import bacGeneral2027 from '@/data/exams/bac-general-2027.json';

describe('T18.1 — Schema validation', () => {
  test('the committed 2027 policy validates against the strict schema', () => {
    expect(() => examPolicySchema.parse(bacGeneral2027)).not.toThrow();
  });

  test('every epreuve id is a unique ASCII kebab-case slug', () => {
    const policy = requireExamPolicy(2027);
    const ids = policy.epreuves.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  test('coefficients sum to totalCoefficient (100)', () => {
    const policy = requireExamPolicy(2027);
    const sum = policy.epreuves.reduce((acc, e) => acc + e.coefficient, 0);
    expect(sum).toBe(policy.totalCoefficient);
    expect(policy.totalCoefficient).toBe(100);
  });

  test('every source has a URL and a note describing what was actually read', () => {
    const policy = requireExamPolicy(2027);
    expect(policy.sources.length).toBeGreaterThan(0);
    for (const source of policy.sources) {
      expect(source.url).toMatch(/^https?:\/\//);
      expect(source.note.length).toBeGreaterThan(0);
    }
  });
});

describe('T18.2 — Session 2027 confirmed coefficients (regulatory research pass)', () => {
  const policy = requireExamPolicy(2027);
  const byId = new Map(policy.epreuves.map((e) => [e.id, e]));

  test('EAF: écrit 5 + oral 5', () => {
    expect(byId.get('eaf-ecrit')?.coefficient).toBe(5);
    expect(byId.get('eaf-oral')?.coefficient).toBe(5);
  });

  test('EAM (mathématiques anticipées): coefficient 2, introduced session 2027', () => {
    expect(byId.get('eam')?.coefficient).toBe(2);
    expect(byId.get('eam')?.introducedSession).toBe(2027);
  });

  test('2 EDS conservées: coefficient 16 each', () => {
    expect(byId.get('eds1')?.coefficient).toBe(16);
    expect(byId.get('eds2')?.coefficient).toBe(16);
  });

  test('Philosophie: coefficient 8', () => {
    expect(byId.get('philosophie')?.coefficient).toBe(8);
  });

  test('Grand Oral: coefficient 8 for session 2027 (reduced from 10 by the EAM introduction)', () => {
    expect(byId.get('grand-oral')?.coefficient).toBe(8);
  });

  test('ponctuelles tronc commun: HG/LVA/LVB/enseignement scientifique/EPS = 6 each, EMC = 2, spécialité abandonnée = 8', () => {
    expect(byId.get('histoire-geographie')?.coefficient).toBe(6);
    expect(byId.get('lva')?.coefficient).toBe(6);
    expect(byId.get('lvb')?.coefficient).toBe(6);
    expect(byId.get('enseignement-scientifique')?.coefficient).toBe(6);
    expect(byId.get('eps')?.coefficient).toBe(6);
    expect(byId.get('emc')?.coefficient).toBe(2);
    expect(byId.get('specialite-abandonnee')?.coefficient).toBe(8);
  });

  test('60/40 split: anticipées+terminales = 60, ponctuelles = 40', () => {
    const anticipeesTerminales = policy.epreuves
      .filter((e) => e.type === 'anticipe' || e.type === 'terminal')
      .reduce((sum, e) => sum + e.coefficient, 0);
    const ponctuelles = policy.epreuves
      .filter((e) => e.type === 'ponctuel')
      .reduce((sum, e) => sum + e.coefficient, 0);
    expect(anticipeesTerminales).toBe(60);
    expect(ponctuelles).toBe(40);
  });
});

describe('T18.3 — Fail closed on unknown session', () => {
  test('getExamPolicy returns null for an unsupported session', () => {
    expect(getExamPolicy(2099)).toBeNull();
    expect(getExamPolicy(2020)).toBeNull();
  });

  test('requireExamPolicy throws for an unsupported session', () => {
    expect(() => requireExamPolicy(2099)).toThrow(/No exam policy registered/);
  });

  test('getSupportedSessions lists exactly the registered sessions', () => {
    expect(getSupportedSessions()).toEqual([2026, 2027, 2028]);
  });

  test('getEpreuve returns undefined for an unknown epreuve id, never a guess', () => {
    const policy = requireExamPolicy(2027);
    expect(getEpreuve(policy, 'epreuve-qui-nexiste-pas')).toBeUndefined();
  });
});

describe('T18.4 — Ponctuelles modality never implies same-session eligibility', () => {
  const policy = requireExamPolicy(2027);

  test('the modality note explicitly rejects the "regroupées en fin de cycle = Bac en un an" conflation', () => {
    const note = policy.candidatIndividuelRules.ponctuellesModality.note;
    expect(note).toMatch(/n'implique PAS/i);
  });

  test('modality choice is global (not per-subject)', () => {
    expect(policy.candidatIndividuelRules.ponctuellesModality.choiceGranularity).toBe('global_not_per_subject');
  });
});

describe('T18.5 — Same-session eligibility (Article 3) — deterministic engine', () => {
  const policy = requireExamPolicy(2027);

  test('confirming an auto-checkable condition (age >= 20) resolves ELIGIBLE', () => {
    const result = checkSameSessionEligibility(policy, { age20: true });
    expect(result.outcome).toBe('ELIGIBLE');
    if (result.outcome === 'ELIGIBLE') {
      expect(result.matchedConditionIds).toContain('age20');
    }
  });

  test('confirming "déjà titulaire d\'un diplôme étranger comparable" resolves ELIGIBLE', () => {
    const result = checkSameSessionEligibility(policy, { diplome_etranger_comparable: true });
    expect(result.outcome).toBe('ELIGIBLE');
  });

  test('all auto-checkable conditions explicitly answered false resolves the standard two-session path', () => {
    const allFalse = Object.fromEntries(
      policy.candidatIndividuelRules.sameSessionEligibility.conditions
        .filter((c) => c.autoCheckable)
        .map((c) => [c.id, false]),
    );
    const result = checkSameSessionEligibility(policy, allFalse);
    expect(result.outcome).toBe('NOT_ELIGIBLE_STANDARD_TWO_SESSION_PATH');
  });

  test('missing answers resolve to human review, never a guess', () => {
    const result = checkSameSessionEligibility(policy, {});
    expect(result.outcome).toBe('ELIGIBILITY_REQUIRES_HUMAN_REVIEW');
  });

  test('flagging a non-auto-checkable condition (force majeure) NEVER resolves ELIGIBLE on its own', () => {
    const allAutoFalse = Object.fromEntries(
      policy.candidatIndividuelRules.sameSessionEligibility.conditions
        .filter((c) => c.autoCheckable)
        .map((c) => [c.id, false]),
    );
    const result = checkSameSessionEligibility(policy, { ...allAutoFalse, force_majeure: true });
    expect(result.outcome).toBe('ELIGIBILITY_REQUIRES_HUMAN_REVIEW');
  });

  test('residence in Tunisia alone is documented as NOT sufficient — no condition auto-approves on residence alone', () => {
    const residenceCondition = policy.candidatIndividuelRules.sameSessionEligibility.conditions.find(
      (c) => c.id === 'residence_permanente_sans_centre',
    );
    expect(residenceCondition?.autoCheckable).toBe(false);
    expect(residenceCondition?.note?.toLowerCase()).toContain('tunisie');
  });

  test('at least one auto-checkable condition exists (schema-enforced, re-asserted here)', () => {
    const autoCheckable = policy.candidatIndividuelRules.sameSessionEligibility.conditions.filter(
      (c) => c.autoCheckable,
    );
    expect(autoCheckable.length).toBeGreaterThan(0);
  });
});

describe('T18.6 — Note conservation and EPS (previously unconfirmed rows)', () => {
  const policy = requireExamPolicy(2027);

  test('grades >= 10/20 are kept for 5 sessions', () => {
    expect(policy.candidatIndividuelRules.noteConservation.thresholdOutOf20).toBe(10);
    expect(policy.candidatIndividuelRules.noteConservation.validSessions).toBe(5);
  });

  test('EPS is a ponctuelle with coefficient 6, not left unconfirmed', () => {
    const eps = getEpreuve(policy, 'eps');
    expect(eps).toBeDefined();
    expect(eps!.coefficient).toBe(6);
    expect(eps!.note).toBeDefined();
  });
});
