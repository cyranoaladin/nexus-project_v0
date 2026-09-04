/**
 * Canonical Quote Context Adapter — the ONLY bridge between ProfilCandidat
 * (staff-managed academic profile, lib/exams/*'s P1-P12 eligibility engine)
 * and the existing, canonical lib/quotes/* engine (buildRecommendation,
 * createQuote, pdf-adapter, etc.). This adapter computes nothing of its
 * own: it derives a SituationInput the existing engine already accepts,
 * and packages the P1-P12 validation/carte results for audit/PDF/
 * regulatory-maturity — it must never become a second pricing or quote
 * engine (Track A, Section 1/7/11).
 */
import type { ProfilCandidatInput } from '@/lib/exams/parcours';
import { buildCandidateQuoteContext } from '@/lib/quotes/candidate-quote-context';

function baseProfil(overrides: Partial<ProfilCandidatInput> = {}): ProfilCandidatInput {
  return {
    level: 'TERMINALE',
    examSession: 2027,
    modalite: 'A',
    specialite1: 'MATHEMATIQUES',
    specialite2: 'NSI',
    specialiteAbandonnee: null,
    langueA: null,
    langueB: null,
    estRedoublant: false,
    estTitulaireBacDejaObtenu: false,
    changementSpecialite: false,
    intentionAmelioration: false,
    intentionCycleComplet: true,
    brancheBascule: null,
    epreuvesDispenseesDeclarees: [],
    etalementPlurisessionsDeclare: false,
    moyenneRattrapage: null,
    optionsTerminale: [],
    notesConservees: null,
    ...overrides,
  };
}

describe('buildCandidateQuoteContext', () => {
  test('derives a SituationInput the existing quote engine already accepts — lowercase level, [specialite1, specialite2] tuple', () => {
    const ctx = buildCandidateQuoteContext(baseProfil({ level: 'TERMINALE', specialite1: 'MATHEMATIQUES', specialite2: 'NSI' }), 2027);
    expect(ctx.situation.level).toBe('terminale');
    expect(ctx.situation.examSession).toBe(2027);
    expect(ctx.situation.specialites).toEqual(['MATHEMATIQUES', 'NSI']);
  });

  test('a PREMIERE profile maps to the lowercase "premiere" the existing engine expects', () => {
    const ctx = buildCandidateQuoteContext(baseProfil({ level: 'PREMIERE' }), 2027);
    expect(ctx.situation.level).toBe('premiere');
  });

  test('optional fields (specialiteAbandonnee/langueA/langueB) are undefined, never null, when absent — matches SituationInput\'s optional (not nullable) contract', () => {
    const ctx = buildCandidateQuoteContext(baseProfil({ specialiteAbandonnee: null, langueA: null, langueB: null }), 2027);
    expect(ctx.situation.specialiteAbandonnee).toBeUndefined();
    expect(ctx.situation.langueA).toBeUndefined();
    expect(ctx.situation.langueB).toBeUndefined();
  });

  test('a nominal P1 profile (primo-candidat, no red flags) resolves emissionAutomatiqueAutorisee=true and regulatoryMaturity=CARTE_VALIDATED_DEFINITIVE', () => {
    const ctx = buildCandidateQuoteContext(baseProfil(), 2027);
    expect(ctx.carte.parcours.parcoursPrincipal).toBe('P1_LIBRE_2ANS_MODALITE_A');
    expect(ctx.emissionAutomatiqueAutorisee).toBe(true);
    expect(ctx.regulatoryMaturity).toBe('CARTE_VALIDATED_DEFINITIVE');
  });

  test('a profile requiring human review (P12 étalement) resolves emissionAutomatiqueAutorisee=false and regulatoryMaturity=LEGACY_ESTIMATE_UNVERIFIED — never silently promoted', () => {
    const ctx = buildCandidateQuoteContext(baseProfil({ etalementPlurisessionsDeclare: true }), 2027);
    expect(ctx.carte.parcours.parcoursPrincipal).toBe('P12_ETALEMENT_PLURISESSIONS');
    expect(ctx.emissionAutomatiqueAutorisee).toBe(false);
    expect(ctx.regulatoryMaturity).toBe('LEGACY_ESTIMATE_UNVERIFIED');
  });

  test('the adapter composes canEmitAutomatically as an AND of validation AND carte — never re-derives the boolean itself', () => {
    const ctx = buildCandidateQuoteContext(baseProfil(), 2027);
    expect(ctx.emissionAutomatiqueAutorisee).toBe(ctx.validation.emissionAutomatiqueAutorisee && ctx.carte.emissionAutomatiqueAutorisee);
  });

  test('the adapter never computes price, margin, or a payment schedule — no such field on its result', () => {
    const ctx = buildCandidateQuoteContext(baseProfil(), 2027);
    expect(ctx).not.toHaveProperty('monthlyTotal');
    expect(ctx).not.toHaveProperty('grandTotal');
    expect(ctx).not.toHaveProperty('deposit');
    expect(ctx).not.toHaveProperty('margin');
  });
});
