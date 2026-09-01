/**
 * Candidat-individuel service/module catalogue — resolution and anti-
 * double-billing (Lot 5, docs/candidat-individuel/lot5-catalogue-
 * brainstorming.md). Incrément 3 removed the transitional adapter into the
 * legacy pricing/recommendation engine's shape — see lib/quotes/
 * candidate-need.ts for the canonical resolver that replaced it.
 *
 * Layering: lib/pricing.ts holds raw JSON access; catalogue-schema.ts holds
 * types + structural validation; this file holds résolution + calcul —
 * never a second copy of the catalogue data itself.
 */
import 'server-only';
import { getCandidatIndividuelCatalogueRaw } from '@/lib/pricing';
import { isAVerifier } from '@/lib/exams/a-verifier';
import type { CarteExamenResult } from '@/lib/exams/carte';
import { normalizeOptionCode } from '@/lib/exams/options';
import type { ProfilCandidatInput } from '@/lib/exams/parcours';
import {
  candidatIndividuelCatalogueSchema,
  type CandidatIndividuelCatalogue,
  type CatalogueModule,
  type DeliveryMode,
  type DirectionApprovalStatus,
  type InclusionPolicy,
  type PricingRuleId,
  type VolumePolicy,
} from './catalogue-schema';

let cachedCatalogue: CandidatIndividuelCatalogue | null = null;

/** Validated entry point — parses + caches. Throws on any structural violation (never silently degrades). */
export function getCatalogue(): CandidatIndividuelCatalogue {
  if (!cachedCatalogue) {
    cachedCatalogue = candidatIndividuelCatalogueSchema.parse(getCandidatIndividuelCatalogueRaw());
  }
  return cachedCatalogue;
}

/** Test-only: forces the next getCatalogue() call to re-parse (e.g. after mocking the raw loader). */
export function resetCatalogueCacheForTests(): void {
  cachedCatalogue = null;
}

export type CatalogueModuleStatus = 'SELECTED' | 'EXCLUDED' | 'NEEDS_HUMAN_REVIEW';

export interface ResolvedCatalogueModule {
  moduleId: string;
  label: string;
  coverageKey: string;
  epreuveCodes: string[];
  optionCodes: string[];
  deliveryMode: DeliveryMode;
  pricingRuleId: PricingRuleId | null;
  volumePolicy: VolumePolicy;
  inclusionPolicy: InclusionPolicy;
  directionApprovalStatus: DirectionApprovalStatus;
  status: CatalogueModuleStatus;
  reason: string;
  /** Sum of matched épreuves' resolved coefficients — null for options-only modules or when SELECTED never applies. */
  coefficientEffectif: number | null;
  /** Catalogue-native (data/pricing.canonical.json), not a code mapping — see catalogue-schema.ts's field doc. */
  defaultCandidateForRegularSupport: boolean;
}

export interface CatalogueSelection {
  /** false only for P11/P12 (mission Lot 5 §6 — Pilotage stays the mandatory socle otherwise). */
  pilotageIncluded: boolean;
  parcoursPrincipal: string;
  /** Every module the catalogue defines, each tagged — nothing silently dropped (mission §4 adapter rule). */
  modules: ResolvedCatalogueModule[];
  necessiteVerificationHumaine: boolean;
  emissionAutomatiqueAutorisee: boolean;
}

function resolveModule(
  module: CatalogueModule,
  carte: CarteExamenResult,
  profil: ProfilCandidatInput,
): ResolvedCatalogueModule {
  const base = {
    moduleId: module.moduleId,
    label: module.label,
    coverageKey: module.coverageKey,
    epreuveCodes: module.epreuveCodes,
    optionCodes: module.optionCodes,
    deliveryMode: module.deliveryMode,
    pricingRuleId: module.pricingRuleId,
    volumePolicy: module.volumePolicy,
    inclusionPolicy: module.inclusionPolicy,
    directionApprovalStatus: module.directionApprovalStatus,
    defaultCandidateForRegularSupport: module.defaultCandidateForRegularSupport,
  };

  // Options-only module (never in carte.epreuves — a distinct vocabulary, lib/exams/options.ts).
  if (module.epreuveCodes.length === 0) {
    const declared = new Set((profil.optionsTerminale ?? []).map(normalizeOptionCode));
    const matched = module.optionCodes.some((code) => declared.has(normalizeOptionCode(code)));
    if (!matched) {
      return { ...base, status: 'EXCLUDED', reason: "Option non déclarée par le candidat.", coefficientEffectif: null };
    }
    if (module.directionApprovalStatus === 'DIRECTION_A_VALIDER') {
      return {
        ...base,
        status: 'NEEDS_HUMAN_REVIEW',
        reason: 'Option déclarée, mais son volume/tarif reste DIRECTION_A_VALIDER — jamais sélectionnée automatiquement (mission §2 règle de blocage).',
        coefficientEffectif: null,
      };
    }
    return { ...base, status: 'SELECTED', reason: 'Option déclarée par le candidat.', coefficientEffectif: null };
  }

  // Épreuve-linked module.
  const matched = carte.epreuves.filter((e) => module.epreuveCodes.includes(e.code));
  if (matched.length === 0) {
    return { ...base, status: 'EXCLUDED', reason: 'Aucune épreuve correspondante sur la carte de ce candidat.', coefficientEffectif: null };
  }

  const uncertain = matched.find((e) => e.necessiteVerificationHumaine);
  if (uncertain) {
    return {
      ...base,
      status: 'NEEDS_HUMAN_REVIEW',
      reason: `Statut de l'épreuve "${uncertain.code}" incertain (${uncertain.statut}, nécessite vérification humaine) — ni inclus ni exclu automatiquement.`,
      coefficientEffectif: null,
    };
  }

  const unresolvedCoefficient = matched.find((e) => isAVerifier(e.coefficientEffectif));
  if (unresolvedCoefficient) {
    return {
      ...base,
      status: 'NEEDS_HUMAN_REVIEW',
      reason: `Coefficient de l'épreuve "${unresolvedCoefficient.code}" À_VERIFIER — module non sélectionnable automatiquement tant qu'il n'est pas résolu.`,
      coefficientEffectif: null,
    };
  }

  const confirmedExcluded = matched.find((e) => (module.statutsCarteExclus as readonly string[]).includes(e.statut));
  if (confirmedExcluded && !module.utileMalgreDispense) {
    return {
      ...base,
      status: 'EXCLUDED',
      reason: `Épreuve "${confirmedExcluded.code}" au statut confirmé ${confirmedExcluded.statut} — aucune préparation nécessaire.`,
      coefficientEffectif: null,
    };
  }

  if (module.directionApprovalStatus === 'DIRECTION_A_VALIDER') {
    return {
      ...base,
      status: 'NEEDS_HUMAN_REVIEW',
      reason: 'Épreuve à préparer, mais le volume/tarif du module reste DIRECTION_A_VALIDER — jamais sélectionné automatiquement (mission §2 règle de blocage).',
      coefficientEffectif: null,
    };
  }

  const coefficientEffectif = matched.reduce((sum, e) => sum + (e.coefficientEffectif as number), 0);
  return {
    ...base,
    status: 'SELECTED',
    reason: `${matched.map((e) => e.code).join(', ')} à préparer.`,
    coefficientEffectif,
  };
}

const PILOTAGE_EXCEPTIONS = new Set(['P11_SECOND_GROUPE', 'P12_ETALEMENT_PLURISESSIONS']);

export function resolveCatalogueModules(carte: CarteExamenResult, profil: ProfilCandidatInput): CatalogueSelection {
  const catalogue = getCatalogue();
  const pilotageIncluded = !PILOTAGE_EXCEPTIONS.has(carte.parcours.parcoursPrincipal);
  const modules = catalogue.modules.map((m) => resolveModule(m, carte, profil));
  const necessiteVerificationHumaine =
    carte.necessiteVerificationHumaine || modules.some((m) => m.status === 'NEEDS_HUMAN_REVIEW');
  const emissionAutomatiqueAutorisee = carte.emissionAutomatiqueAutorisee && !necessiteVerificationHumaine;
  return {
    pilotageIncluded,
    parcoursPrincipal: carte.parcours.parcoursPrincipal,
    modules,
    necessiteVerificationHumaine,
    emissionAutomatiqueAutorisee,
  };
}

// ── Anti-double-billing (mission §5/§6 — coverageKeys, never facturer deux fois la même couverture) ──

export interface SelectedCoverageItem {
  /** serviceId or moduleId — whatever is being billed/included. */
  id: string;
  coverageKey: string;
}

export interface DoubleBillingIssue {
  coverageKey: string;
  sources: string[];
  explanation: string;
}

export function detectDoubleBilling(items: SelectedCoverageItem[]): DoubleBillingIssue[] {
  const byKey = new Map<string, string[]>();
  for (const item of items) {
    const existing = byKey.get(item.coverageKey);
    if (existing) existing.push(item.id);
    else byKey.set(item.coverageKey, [item.id]);
  }
  const issues: DoubleBillingIssue[] = [];
  for (const [coverageKey, sources] of byKey) {
    if (sources.length > 1) {
      issues.push({
        coverageKey,
        sources,
        explanation: `${sources.join(' et ')} couvrent tous deux "${coverageKey}" — une seule de ces lignes doit être facturée.`,
      });
    }
  }
  return issues;
}

/** The coverage items a resolved selection would actually bill — Pilotage's bundle (if included) + every SELECTED module. */
export function coverageItemsForSelection(selection: CatalogueSelection): SelectedCoverageItem[] {
  const catalogue = getCatalogue();
  const items: SelectedCoverageItem[] = [];
  if (selection.pilotageIncluded) {
    const pilotage = catalogue.services.find((s) => s.serviceId === 'SVC_PILOTAGE');
    if (pilotage) {
      for (const coverageKey of pilotage.coverageKeys) items.push({ id: pilotage.serviceId, coverageKey });
    }
  }
  for (const m of selection.modules) {
    if (m.status === 'SELECTED') items.push({ id: m.moduleId, coverageKey: m.coverageKey });
  }
  return items;
}
