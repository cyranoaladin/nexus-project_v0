/**
 * buildCandidateQuoteRecommendation — the single canonical orchestrator for
 * the carte-aware candidat-individuel pipeline (mission "recâblage" §4,
 * revised §1/§2 to integrate diagnostic and budget).
 *
 *   carte réglementaire → modules éligibles → diagnostic → priorité →
 *   plan idéal → optimisation budgétaire → packs → tarification → marge →
 *   scénarios
 *
 * Every step reuses an existing, already-tested function — this file
 * contains zero regulatory or pricing logic of its own, only sequencing
 * and the discriminated result type. Diagnostic/priority/optimizer are
 * NEVER re-implemented here (mission §2 "ne pas laisser deux optimiseurs
 * concurrents") — projectDiagnostic/scoreSubjects/buildIdealRecommendation/
 * optimizeForBudget/matchCanonicalPack/computeCandidatLibreSchedule are the
 * exact same functions the legacy engine (lib/quotes/recommendation.ts)
 * uses, fed with the carte-aware module selection resolved directly into
 * candidate needs (lib/quotes/candidate-need.ts, incrément 3 — no more
 * round-trip through the legacy buildExamProfile(situation) shape).
 * Never returns an ambiguous null: every outcome is one of the 7 named
 * states below, each carrying exactly the data that state can legitimately
 * have.
 */
import 'server-only';
import type { Subject } from '@prisma/client';
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
import { deriveEligibilityAnswersFromAudit, type P3EligibiliteAudit, type ProfilCandidatInput } from '@/lib/exams/parcours';
import { validateProfilCandidat, type ProfileValidationResult } from '@/lib/exams/profile-validation';
import {
  coverageItemsForSelection,
  detectDoubleBilling,
  getCatalogue,
  resolveCatalogueModules,
  type CatalogueSelection,
} from './catalogue';
import { resolveCandidateNeeds } from './candidate-need';
import { computeCandidatLibreSchedule } from './pricing';
import { buildIdealRecommendation } from './pricing';
import { projectDiagnosticCore, type CanonicalDiagnosticContext, type RawDomainScores } from './diagnostic';
import { scoreSubjects } from './priority';
import { optimizeForBudget } from './optimizer';
import { matchCanonicalPack } from './recommendation';
import {
  ALWAYS_INCLUDED_PRIORITY_SCORE,
  SCENARIO_TIER_BY_STRATEGY,
  type BudgetInput,
  type QuoteScenario,
  type ScenarioTier,
} from './schemas';
import {
  buildSecondGroupeScenarios,
  DiscountRejectedError,
  DoubleBillingDetectedError,
  MarginTooLowError,
  NoCostDataError,
  UnapprovedCatalogueElementError,
} from './pricing-engine';

export interface CandidateQuotePipelineInput {
  publicInput: PublicCandidateInputRaw;
  staffExtension?: {
    notesConservees?: StaffNoteInputRaw[] | null;
    dispensesDeclarees?: StaffDispenseInputRaw[] | null;
    /**
     * ADR-dette-reconduction-p3-gates.md Gate 2 — the ONLY way P3
     * eligibility can be established. There is deliberately no direct
     * EligibilityAnswers parameter on this input: a caller (public or
     * staff) can never hand the engine a pre-computed "age20: true" without
     * going through this audited trail — deriveEligibilityAnswersFromAudit
     * only ever sets `true` for a CONFIRMEE decision.
     */
    p3EligibiliteAudit?: P3EligibiliteAudit[] | null;
  };
  /**
   * Absent (null/undefined) -> "diagnostic absent" (mission §1): every
   * subject defaults to NON_EVALUE — scoreSubjects already degrades this
   * way natively, never a fabricated fallback built here.
   */
  diagnostic?: { raw: RawDomainScores; overconfidentDomainKeys?: Set<string> } | null;
  /** Required — matches the existing product reality (the current public flow already always asks for a budget). */
  budget: BudgetInput;
  /**
   * 1-10 (September=1..June=10). Defaults to a full year, same as the
   * legacy engine. ADR-MID-YEAR-BILLING-MODEL.md: pedagogical priority
   * signal only — never reaches the payment schedule.
   */
  pedagogicalUrgencyMonths?: number;
}

export type DiagnosticStatus = 'ABSENT' | 'EXPLOITABLE' | 'INCOMPLET';

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
      /**
       * Catalogue SERVICES (not modules) still DIRECTION_A_VALIDER — mission
       * "vers un produit complet", lot de fermeture P11. Distinct array
       * (never merged into pendingModuleIds, whose name and every existing
       * consumer assume module ids) so a P11 profile (SVC_SECOND_GROUPE)
       * surfaces here without silently relabeling a service as a module.
       * Empty whenever no service-level approval is pending.
       */
      pendingServiceIds: string[];
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
       * constructed by buildCandidateQuoteRecommendation today.
       */
      status: 'PROVISIONAL';
      carte: CarteExamenResult;
      validation: ProfileValidationResult;
      selection: CatalogueSelection;
      scenarios: QuoteScenario[];
      pendingConfirmations: string[];
    }
  | {
      status: 'READY';
      carte: CarteExamenResult;
      validation: ProfileValidationResult;
      selection: CatalogueSelection;
      diagnosticStatus: DiagnosticStatus;
      /** ESSENTIEL / RECOMMANDE / COMPLET — same 3-tier shape the legacy engine already produces. */
      scenarios: QuoteScenario[];
      /**
       * True when even the ESSENTIEL (RESPECT_BUDGET) scenario's total
       * exceeds the stated budget — Pilotage alone already does (optimizer.ts
       * never drops it). Mission §2: "le budget ne doit jamais retirer
       * silencieusement une obligation réglementaire" — this makes that case
       * an explicit, checkable result field rather than a silently
       * over-budget scenario.
       */
      budgetInsuffisantPourSocle: boolean;
      /**
       * SELECTED modules with no known pedagogical classification (see
       * lib/quotes/candidate-need.ts's MODULE_TO_SUBJECT) — always empty
       * by construction on this READY branch (a non-empty case turns into
       * UNPRICED before scenarios are ever built, see step 8 above). Kept
       * for API/UI backward compatibility (CandidatIndividuelWorkspace.tsx
       * renders this field).
       */
      modulesNonRepresentables: string[];
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
    p3EligibiliteAudit: staff.p3EligibiliteAudit.length > 0 ? staff.p3EligibiliteAudit : null,
  };
}

/** The canonical staff pipeline builds a CanonicalDiagnosticContext directly from ProfilCandidatInput — no SituationInput round-trip (the legacy shape stays confined to lib/quotes/recommendation.ts, via projectDiagnostic's own boundary adapter in diagnostic.ts). */
function profilToDiagnosticContext(profil: ProfilCandidatInput): CanonicalDiagnosticContext {
  return {
    level: profil.level,
    eds1: profil.specialite1 as Subject,
    eds2: profil.specialite2 as Subject,
    langueA: (profil.langueA as Subject | null) ?? null,
    langueB: (profil.langueB as Subject | null) ?? null,
    specialiteAbandonnee: (profil.specialiteAbandonnee as Subject | null) ?? null,
  };
}

function buildScenario(
  tier: ScenarioTier,
  strategy: BudgetInput['strategy'],
  idealLines: ReturnType<typeof buildIdealRecommendation>['lines'],
  idealNotRecommended: ReturnType<typeof buildIdealRecommendation>['notRecommended'],
  budget: BudgetInput,
  level: 'premiere' | 'terminale',
): QuoteScenario {
  const optimized = optimizeForBudget(idealLines, budget.monthlyBudgetTnd, strategy);
  const notRecommended = [...idealNotRecommended, ...optimized.droppedForBudget];

  const regularHoursNeeded = optimized.lines
    .filter((l) => l.modality === 'GROUPE' && l.hoursPerMonth != null)
    .reduce((sum, l) => sum + (l.hoursPerMonth ?? 0), 0);
  const pack = matchCanonicalPack(level, regularHoursNeeded, optimized.monthlyTotal);

  if (pack) {
    return {
      tier,
      lines: [
        {
          subject: 'pack',
          label: pack.title,
          modality: 'PACK',
          hoursPerMonth: null,
          unitPriceMonthly: pack.installmentAmount,
          priorityScore: ALWAYS_INCLUDED_PRIORITY_SCORE,
          priorityLabel: 'haute',
          reason: `Ce parcours combiné (${pack.priceAnnual} TND/an) couvre les mêmes besoins que la somme des modules équivalents (${optimized.monthlyTotal * 10} TND/an) pour un tarif identique ou inférieur.`,
          offerId: pack.offerId,
        },
      ],
      notRecommended,
      monthlyTotal: pack.installmentAmount,
      grandTotal: pack.priceAnnual,
      months: 10,
      matchedOfferId: pack.offerId,
      paymentPolicy: 'ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS',
      deposit: pack.deposit,
      lastInstallmentAmount: pack.lastInstallmentAmount,
      includedFeatures: pack.includedFeatures,
    };
  }

  const grandTotal = optimized.monthlyTotal * 10;
  const schedule = computeCandidatLibreSchedule(grandTotal);
  return {
    tier,
    lines: optimized.lines,
    notRecommended,
    monthlyTotal: schedule.installmentAmount,
    grandTotal,
    months: 10,
    matchedOfferId: null,
    paymentPolicy: 'ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS',
    deposit: schedule.deposit,
    lastInstallmentAmount: schedule.lastInstallmentAmount,
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
  // ADR-dette-reconduction-p3-gates.md Gate 2 — the only source of P3
  // eligibility answers; a family/public caller can never hand the engine
  // a pre-computed boolean directly (see CandidateQuotePipelineInput).
  const bacAccelereEligibilityAnswers = deriveEligibilityAnswersFromAudit(staff.p3EligibiliteAudit);

  // 2. Validation du profil
  const validation = validateProfilCandidat(policy, { profil, bacAccelereEligibilityAnswers });
  if (!validation.valide) {
    return { status: 'INVALID', reasons: validation.erreurs.map((e) => e.messageFamille), normalized };
  }

  // 3/4. Résolution ParcoursType + génération CarteExamen (genererCarteExamen calls resolveParcoursType internally)
  const carte = genererCarteExamen({ profil, policy, bacAccelereEligibilityAnswers });

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

  // 6a. P11 (second groupe) — a narrow, contained rattrapage of 2
  // disciplines, not a full annual subject-priority plan. Mission "vers
  // un produit complet", lot de fermeture P11: SVC_SECOND_GROUPE was
  // catalogued (data/pricing.canonical.json) but architecturally never
  // connected to any pricing path — confirmed by reading catalogue.ts,
  // pricing.ts, and pipeline.ts in full: resolveCatalogueModules only
  // ever processes catalogue.modules (11 subject-linked modules) +
  // SVC_PILOTAGE, never any other catalogue.services entry, and
  // buildIdealRecommendation/optimizeForBudget/matchCanonicalPack (the
  // standard path below) have zero awareness of parcoursPrincipal. That
  // machinery is skipped entirely for P11 — it would silently price a
  // narrow rattrapage through the same subject-priority logic as a
  // standard 2-year candidate, semantically wrong for what P11 actually
  // is. Gated the same way every DIRECTION_A_VALIDER module already is
  // (checked BEFORE any pricing function runs, never inside one) —
  // buildSecondGroupeScenarios (lib/quotes/pricing-engine.ts) is pure
  // computation and does not re-check this itself.
  if (carte.parcours.parcoursPrincipal === 'P11_SECOND_GROUPE') {
    const p11Selection = resolveCatalogueModules(carte, profil);
    const secondGroupeService = getCatalogue().services.find((s) => s.serviceId === 'SVC_SECOND_GROUPE');
    if (!secondGroupeService || secondGroupeService.directionApprovalStatus !== 'APPROVED') {
      return {
        status: 'DIRECTION_APPROVAL_REQUIRED',
        carte,
        validation,
        selection: p11Selection,
        pendingModuleIds: [],
        pendingServiceIds: ['SVC_SECOND_GROUPE'],
      };
    }
    // Only reachable when a test fixture mocks the catalogue raw loader to
    // mark SVC_SECOND_GROUPE APPROVED in a disposable database — the real
    // canonical catalogue (data/pricing.canonical.json) keeps it
    // DIRECTION_A_VALIDER, so this branch never executes against
    // production data today.
    return {
      status: 'READY',
      carte,
      validation,
      selection: p11Selection,
      diagnosticStatus: 'ABSENT',
      scenarios: buildSecondGroupeScenarios(),
      // "budget mensuel insuffisant pour le socle" has no meaning against a
      // single, one-time, non-monthly payment — never compared here.
      budgetInsuffisantPourSocle: false,
      modulesNonRepresentables: [],
    };
  }

  // 6. Sélection des modules
  const selection = resolveCatalogueModules(carte, profil);
  const pendingModuleIds = selection.modules
    .filter((m) => m.status === 'NEEDS_HUMAN_REVIEW' && m.directionApprovalStatus === 'DIRECTION_A_VALIDER')
    .map((m) => m.moduleId);
  if (pendingModuleIds.length > 0) {
    return { status: 'DIRECTION_APPROVAL_REQUIRED', carte, validation, selection, pendingModuleIds, pendingServiceIds: [] };
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

  // 8. Modules éligibles -> besoins candidat canoniques (lib/quotes/candidate-need.ts) — jamais un second mapping matière/module.
  const { needs, emissionAutomatiqueAutorisee: needsRepresentable } = resolveCandidateNeeds(selection, carte, profil);
  if (!needsRepresentable) {
    // Only reachable if a future module gains a SELECTED status without a
    // pedagogical classification in candidate-need.ts's MODULE_TO_SUBJECT —
    // defensive, not exercised by any APPROVED module today (all have one).
    return {
      status: 'UNPRICED',
      carte,
      validation,
      selection,
      reason: 'Un module sélectionné n\'a pas de classification pédagogique connue — voir lib/quotes/candidate-need.ts.',
    };
  }

  try {
    // 9. Diagnostic — absent -> every subject NON_EVALUE (scoreSubjects' own graceful degradation, never fabricated here).
    const diagnosticContext = profilToDiagnosticContext(profil);
    const diagnosticResults = input.diagnostic
      ? projectDiagnosticCore(diagnosticContext, input.diagnostic.raw, input.diagnostic.overconfidentDomainKeys)
      : [];
    const diagnosticStatus: DiagnosticStatus = !input.diagnostic
      ? 'ABSENT'
      : diagnosticResults.some((d) => d.tier === 'NON_EVALUE')
        ? 'INCOMPLET'
        : 'EXPLOITABLE';

    // 10. Priorité (reused) + plan idéal (reused). scoreSubjects/buildIdealRecommendation
    // are never modified for this migration — the shape below structurally
    // satisfies their existing parameter type (same 4 fields, same
    // pedagogicalSlot values as the old `subject` key) without importing
    // the legacy exam-profile module's type.
    const scorableSubjects = needs.map((n) => ({
      subject: n.pedagogicalSlot,
      label: n.humanLabel,
      epreuveIds: n.epreuveIds,
      coefficient: n.coefficient,
      defaultCandidateForRegularSupport: n.defaultCandidateForRegularSupport,
    }));
    const foundationalSubjects = new Set(
      needs.filter((n) => n.defaultCandidateForRegularSupport).map((n) => n.pedagogicalSlot),
    );
    const priorities = scoreSubjects(scorableSubjects, diagnosticResults, input.pedagogicalUrgencyMonths);
    const ideal = buildIdealRecommendation(priorities, foundationalSubjects);

    // 11. Optimisation budgétaire (reused) + 12. packs (reused) -> 3 scénarios.
    const level = profil.level === 'PREMIERE' ? 'premiere' : 'terminale';
    const scenarios = (['RESPECT_BUDGET', 'BEST_BALANCE', 'MOST_COMPLETE'] as const).map((strategy) =>
      buildScenario(SCENARIO_TIER_BY_STRATEGY[strategy], strategy, ideal.lines, ideal.notRecommended, input.budget, level),
    );

    const essentiel = scenarios.find((s) => s.tier === 'ESSENTIEL')!;
    const budgetInsuffisantPourSocle = essentiel.monthlyTotal > input.budget.monthlyBudgetTnd;

    return {
      status: 'READY',
      carte,
      validation,
      selection,
      diagnosticStatus,
      scenarios,
      budgetInsuffisantPourSocle,
      modulesNonRepresentables: [],
    };
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
}
