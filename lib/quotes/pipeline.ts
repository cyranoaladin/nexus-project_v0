/**
 * buildCandidateQuoteRecommendation — the single canonical orchestrator for
 * the carte-aware candidat-individuel pipeline (mission "recâblage" §4).
 *
 *   normalisation → validation du profil → résolution ParcoursType →
 *   génération CarteExamen → gate réglementaire → sélection des modules →
 *   contrôle anti-doublon → tarification → garde-fous de marge →
 *   comparaison des packs → échéancier → scénarios → snapshot
 *
 * Every step reuses an existing, already-tested function — this file
 * contains zero regulatory or pricing logic of its own, only sequencing
 * and the discriminated result type. Never returns an ambiguous null:
 * every outcome is one of the 7 named states below, each carrying exactly
 * the data that state can legitimately have.
 */
import 'server-only';
import type { EligibilityAnswers } from '@/lib/exams/catalog';
import { assertSessionSellable, requireExamPolicy } from '@/lib/exams/catalog';
import { genererCarteExamen, type CarteExamenResult } from '@/lib/exams/carte';
import { canEmitAutomatically } from '@/lib/exams/emission-gate';
import {
  isFullyNormalized,
  normalizePublicCandidateInput,
  normalizeStaffExtension,
  type NormalizedPublicCandidateInput,
  type PublicCandidateInputRaw,
  type StaffCandidateInputExtension,
  type StaffDispenseInputRaw,
  type StaffNoteInputRaw,
} from '@/lib/exams/normalize';
import type { ProfilCandidatInput } from '@/lib/exams/parcours';
import { validateProfilCandidat, type ProfileValidationResult } from '@/lib/exams/profile-validation';
import {
  coverageItemsForSelection,
  detectDoubleBilling,
  resolveCatalogueModules,
  type CatalogueSelection,
} from './catalogue';
import {
  compareSelectionToCanonicalPacks,
  DiscountRejectedError,
  DoubleBillingDetectedError,
  MarginTooLowError,
  NoCostDataError,
  priceSelection,
  UnapprovedCatalogueElementError,
  buildPricingEngineSnapshot,
  type PricedQuote,
  type PricingEngineSnapshot,
} from './pricing-engine';

export interface CandidateQuotePipelineInput {
  publicInput: PublicCandidateInputRaw;
  staffExtension?: {
    notesConservees?: StaffNoteInputRaw[] | null;
    dispensesDeclarees?: StaffDispenseInputRaw[] | null;
  };
  bacAccelereEligibilityAnswers?: EligibilityAnswers;
}

export type CandidateQuotePipelineResult =
  | { status: 'INVALID'; reasons: string[]; normalized: NormalizedPublicCandidateInput }
  | { status: 'NOT_ELIGIBLE'; reasons: string[]; carte: CarteExamenResult; validation: ProfileValidationResult }
  | {
      status: 'HUMAN_REVIEW_REQUIRED';
      carte: CarteExamenResult;
      validation: ProfileValidationResult;
      avertissements: string[];
    }
  | {
      status: 'DIRECTION_APPROVAL_REQUIRED';
      carte: CarteExamenResult;
      validation: ProfileValidationResult;
      selection: CatalogueSelection;
      pendingModuleIds: string[];
    }
  | {
      status: 'UNPRICED';
      carte: CarteExamenResult;
      validation: ProfileValidationResult;
      selection: CatalogueSelection;
      reason: string;
    }
  | {
      /**
       * Reserved: reachable once the pipeline input carries per-module
       * effectif (mission §10 — DUO/SOLO bascule needs a family consent
       * step before a group-priced line is contractually final). Not
       * constructed by buildCandidateQuoteRecommendation today — this
       * orchestrator has no effectif input yet, so no line ever needs a
       * pending confirmation. Kept in the union now so a future caller's
       * exhaustive switch doesn't need to change shape twice.
       */
      status: 'PROVISIONAL';
      carte: CarteExamenResult;
      validation: ProfileValidationResult;
      selection: CatalogueSelection;
      priced: PricedQuote;
      pendingConfirmations: string[];
    }
  | {
      status: 'READY';
      carte: CarteExamenResult;
      validation: ProfileValidationResult;
      selection: CatalogueSelection;
      priced: PricedQuote;
      snapshot: PricingEngineSnapshot;
      packComparison: ReturnType<typeof compareSelectionToCanonicalPacks>;
    };

function buildProfilFromNormalized(
  normalized: NormalizedPublicCandidateInput,
  staff: StaffCandidateInputExtension,
): ProfilCandidatInput {
  const value = <T>(o: { status: string; value?: T }): T | null => (o.status === 'RESOLVED' ? (o.value as T) : null);
  return {
    level: value(normalized.level)!,
    examSession: normalized.examSession!,
    modalite: value(normalized.modalite)!,
    specialite1: value(normalized.specialite1)!,
    specialite2: value(normalized.specialite2)!,
    specialiteAbandonnee: value(normalized.specialiteAbandonnee),
    langueA: value(normalized.langueA),
    langueB: value(normalized.langueB),
    estRedoublant: normalized.estRedoublant,
    estTitulaireBacDejaObtenu: normalized.estTitulaireBacDejaObtenu,
    changementSpecialite: normalized.changementSpecialite,
    intentionAmelioration: normalized.intentionAmelioration,
    intentionCycleComplet: normalized.intentionCycleComplet,
    brancheBascule: value(normalized.brancheBascule),
    epreuvesDispenseesDeclarees: [],
    dispensesDeclarees: staff.dispensesDeclarees.length > 0 ? staff.dispensesDeclarees : null,
    etalementPlurisessionsDeclare: normalized.etalementPlurisessionsDeclare,
    moyenneRattrapage: normalized.moyenneRattrapage,
    optionsTerminale: normalized.optionsTerminale
      .filter((o) => o.status === 'RESOLVED')
      .map((o) => (o as { status: 'RESOLVED'; value: string }).value),
    notesConservees: staff.notesConservees.length > 0 ? staff.notesConservees : null,
  };
}

export function buildCandidateQuoteRecommendation(input: CandidateQuotePipelineInput): CandidateQuotePipelineResult {
  // 1. Normalisation
  const normalized = normalizePublicCandidateInput(input.publicInput);
  if (!isFullyNormalized(normalized) || normalized.examSession == null) {
    const reasons = Object.entries(normalized.auditTrail).map(([field, raw]) => `${field}: valeur non résolue "${raw}"`);
    if (normalized.examSession == null) reasons.push('examSession manquant');
    return { status: 'INVALID', reasons, normalized };
  }

  let policy;
  try {
    assertSessionSellable(normalized.examSession);
    policy = requireExamPolicy(normalized.examSession);
  } catch (error) {
    return {
      status: 'INVALID',
      reasons: [error instanceof Error ? error.message : 'session non commercialisable'],
      normalized,
    };
  }

  const staff = normalizeStaffExtension(input.staffExtension ?? {});
  const profil = buildProfilFromNormalized(normalized, staff);

  // 2. Validation du profil
  const validation = validateProfilCandidat(policy, {
    profil,
    bacAccelereEligibilityAnswers: input.bacAccelereEligibilityAnswers,
  });
  if (!validation.valide) {
    return { status: 'INVALID', reasons: validation.erreurs.map((e) => e.messageFamille), normalized };
  }

  // 3/4. Résolution ParcoursType + génération CarteExamen (genererCarteExamen calls resolveParcoursType internally)
  const carte = genererCarteExamen({ profil, policy, bacAccelereEligibilityAnswers: input.bacAccelereEligibilityAnswers });

  const p3NotEligible = validation.avertissements
    .concat(validation.informations)
    .find((i) => i.code === 'P3_NON_ELIGIBLE');
  if (p3NotEligible && carte.parcours.parcoursPrincipal === 'P3_LIBRE_1AN_DEROGATION') {
    return { status: 'NOT_ELIGIBLE', reasons: [p3NotEligible.messageFamille], carte, validation };
  }

  // 5. Gate réglementaire (AND, jamais recalculé ailleurs — lib/exams/emission-gate.ts)
  if (!canEmitAutomatically(validation, carte)) {
    const avertissements = [
      ...validation.erreurs.map((e) => e.messageFamille),
      ...validation.avertissements.map((a) => a.messageFamille),
      ...carte.avertissementsGeneraux,
      ...carte.epreuves.flatMap((e) => e.avertissements),
    ];
    return { status: 'HUMAN_REVIEW_REQUIRED', carte, validation, avertissements };
  }

  // 6. Sélection des modules
  const selection = resolveCatalogueModules(carte, profil);
  const pendingModuleIds = selection.modules
    .filter((m) => m.status === 'NEEDS_HUMAN_REVIEW' && m.directionApprovalStatus === 'DIRECTION_A_VALIDER')
    .map((m) => m.moduleId);
  if (pendingModuleIds.length > 0) {
    return { status: 'DIRECTION_APPROVAL_REQUIRED', carte, validation, selection, pendingModuleIds };
  }
  if (!selection.emissionAutomatiqueAutorisee) {
    return {
      status: 'HUMAN_REVIEW_REQUIRED',
      carte,
      validation,
      avertissements: selection.modules.filter((m) => m.status === 'NEEDS_HUMAN_REVIEW').map((m) => m.reason),
    };
  }

  // 7. Anti-doublon (avant tarification — échoue tôt, jamais silencieusement)
  const doubleBillingIssues = detectDoubleBilling(coverageItemsForSelection(selection));
  if (doubleBillingIssues.length > 0) {
    return {
      status: 'UNPRICED',
      carte,
      validation,
      selection,
      reason: `Anti-doublon : ${doubleBillingIssues.map((i) => i.explanation).join(' | ')}`,
    };
  }

  // 8/9/10/11/12. Tarification, garde-fous de marge (structurels — priceSelection refuse déjà tout élément non approuvé), comparaison de packs, échéancier, snapshot
  let priced: PricedQuote;
  try {
    priced = priceSelection(selection);
  } catch (error) {
    if (
      error instanceof UnapprovedCatalogueElementError ||
      error instanceof NoCostDataError ||
      error instanceof DoubleBillingDetectedError ||
      error instanceof DiscountRejectedError ||
      error instanceof MarginTooLowError
    ) {
      return { status: 'UNPRICED', carte, validation, selection, reason: error.message };
    }
    throw error;
  }

  const packComparison = compareSelectionToCanonicalPacks(profil.level === 'PREMIERE' ? 'premiere' : 'terminale', priced);
  const snapshot = buildPricingEngineSnapshot(priced);

  return { status: 'READY', carte, validation, selection, priced, snapshot, packComparison };
}
