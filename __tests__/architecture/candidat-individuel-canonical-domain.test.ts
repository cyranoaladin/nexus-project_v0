import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveCandidateNeeds, type ResolvedCandidateNeed } from '@/lib/quotes/candidate-need';
import type { CatalogueSelection, ResolvedCatalogueModule } from '@/lib/quotes/catalogue';
import type { CarteExamenResult } from '@/lib/exams/carte';
import type { ProfilCandidatInput } from '@/lib/exams/parcours';

/**
 * Incrément 3 — invariants A-F (mission §4), RED before the migration,
 * GREEN after lib/quotes/pipeline.ts stops routing through
 * adaptCatalogueSelectionToExamProfile. See
 * docs/audits/candidat-individuel-zero-debt-reachability.md's incrément 3
 * report for the full migration rationale.
 */

const root = process.cwd();

function read(relPath: string): string {
  return readFileSync(join(root, relPath), 'utf8');
}

function fakeModule(overrides: Partial<ResolvedCatalogueModule> = {}): ResolvedCatalogueModule {
  return {
    moduleId: 'MOD_TEST',
    label: 'Module de test',
    coverageKey: 'TEST_COVERAGE',
    epreuveCodes: [],
    optionCodes: [],
    deliveryMode: 'petit_groupe',
    pricingRuleId: null,
    volumePolicy: { kind: 'non_applicable' },
    inclusionPolicy: 'vendable_separement',
    directionApprovalStatus: 'APPROVED',
    status: 'SELECTED',
    reason: 'test',
    coefficientEffectif: 10,
    defaultCandidateForRegularSupport: true,
    ...overrides,
  };
}

function fakeSelection(modules: ResolvedCatalogueModule[]): CatalogueSelection {
  return {
    pilotageIncluded: true,
    parcoursPrincipal: 'P1_LIBRE_DEUX_ANS',
    modules,
    necessiteVerificationHumaine: false,
    emissionAutomatiqueAutorisee: true,
  };
}

const emptyCarte: CarteExamenResult = {
  epreuves: [],
  totalCoefficientObligatoire: 0,
  totalCoefficientOptions: 0,
  necessiteVerificationHumaine: false,
  avertissementsGeneraux: [],
  emissionAutomatiqueAutorisee: true,
  parcours: { parcoursPrincipal: 'P1_LIBRE_DEUX_ANS', modificateurs: [] },
} as unknown as CarteExamenResult;

const fakeProfil: ProfilCandidatInput = {
  level: 'TERMINALE',
  examSession: 2026,
  modalite: 'A',
  specialite1: 'MATHEMATIQUES',
  specialite2: 'NSI',
  specialiteAbandonnee: null,
  langueA: 'ANGLAIS',
  langueB: null,
  estRedoublant: false,
  estTitulaireBacDejaObtenu: false,
  changementSpecialite: false,
  intentionAmelioration: false,
  intentionCycleComplet: false,
  brancheBascule: null,
  epreuvesDispenseesDeclarees: [],
  dispensesDeclarees: null,
  etalementPlurisessionsDeclare: false,
  moyenneRattrapage: null,
  optionsTerminale: [],
  notesConservees: null,
  p3EligibiliteAudit: null,
} as unknown as ProfilCandidatInput;

describe('invariants A/B/C — pipeline.ts no longer routes through the legacy shape adapter', () => {
  const pipelineSource = read('lib/quotes/pipeline.ts');

  test('A. pipeline.ts does not import adaptCatalogueSelectionToExamProfile', () => {
    expect(pipelineSource).not.toMatch(/adaptCatalogueSelectionToExamProfile/);
  });

  test("B. pipeline.ts does not depend on ExamProfileSubject to represent catalogue needs", () => {
    expect(pipelineSource).not.toMatch(/ExamProfileSubject/);
  });

  test("C. pipeline.ts never imports from './exam-profile' (the legacy engine's own module)", () => {
    expect(pipelineSource).not.toMatch(/from ['"]\.\/exam-profile['"]/);
  });
});

describe('invariant D — a SELECTED module always produces exactly one ResolvedCandidateNeed, never silently absent', () => {
  test('a SELECTED, classifiable module (MOD_EDS1) produces a need carrying its real subject/coefficient', () => {
    const selection = fakeSelection([
      fakeModule({ moduleId: 'MOD_EDS1', epreuveCodes: ['eds1'], coefficientEffectif: 16 }),
    ]);
    const result = resolveCandidateNeeds(selection, emptyCarte, fakeProfil);
    expect(result.needs).toHaveLength(1);
    expect(result.needs[0].pedagogicalSlot).toBe('eds1');
    expect(result.needs[0].pedagogicalSubject).toBe('MATHEMATIQUES');
    expect(result.needs[0].coefficient).toBe(16);
  });

  test('an EXCLUDED module never produces a need (genuinely not needed, not a silent drop)', () => {
    const selection = fakeSelection([fakeModule({ moduleId: 'MOD_EDS1', status: 'EXCLUDED', coefficientEffectif: null })]);
    const result = resolveCandidateNeeds(selection, emptyCarte, fakeProfil);
    expect(result.needs).toHaveLength(0);
  });
});

describe('invariant E — a SELECTED module with no known pedagogical classification never silently disappears; it fails closed', () => {
  test('a SELECTED module with an unknown moduleId makes emissionAutomatiqueAutorisee false (the pipeline turns this into UNPRICED), never a need that just vanishes', () => {
    const selection = fakeSelection([fakeModule({ moduleId: 'MOD_DOES_NOT_EXIST_IN_ANY_TABLE' })]);
    const result = resolveCandidateNeeds(selection, emptyCarte, fakeProfil);
    expect(result.emissionAutomatiqueAutorisee).toBe(false);
    // Still never silently drops it from the needs list either — it must be traceable.
    expect(result.needs.some((n: ResolvedCandidateNeed) => n.catalogueModuleId === 'MOD_DOES_NOT_EXIST_IN_ANY_TABLE')).toBe(false);
  });
});
