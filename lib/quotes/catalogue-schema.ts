/**
 * Structural schema for the candidat-individuel service/module catalogue
 * (Lot 5, docs/candidat-individuel/lot5-catalogue-brainstorming.md §5).
 *
 * This validates STRUCTURE only (types, uniqueness) — cross-checking
 * epreuveCodes against the real lib/exams/ épreuve ids and pricingRuleId
 * against the real candidat_individuel_modules rate table is done by
 * lib/quotes/catalogue.ts's loader (data-dependent, would create a layering
 * violation if baked into this pure schema).
 */
import { z } from 'zod';

export const deliveryModeSchema = z.enum([
  'pilotage',
  'groupe',
  'petit_groupe',
  'duo',
  'individuel_presentiel',
  'individuel_en_ligne',
  'autonomie_guidee_aria',
  'forfait',
  'pack',
  'service_administratif',
]);
export type DeliveryMode = z.infer<typeof deliveryModeSchema>;

/**
 * Mission Lot 5 Décision 2 — 8 distinct states, never 0/null/a guessed
 * number: module sans volume applicable / forfaitaire / inclus / nul /
 * non décidé / calculé (dérivé d'une offre existante) / plafonné / estimatif.
 */
export const volumePolicySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('non_applicable') }).strict(),
  z.object({ kind: z.literal('forfait') }).strict(),
  z.object({ kind: z.literal('inclus_service_transverse') }).strict(),
  z.object({ kind: z.literal('nul') }).strict(),
  z.object({ kind: z.literal('direction_a_valider'), noteArbitrage: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('derive'), hoursPerMonth: z.number().positive(), source: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('plafonne'), totalHoursMax: z.number().positive(), note: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('estimatif'), hoursPerMonth: z.number().positive(), note: z.string().min(1) }).strict(),
]);
export type VolumePolicy = z.infer<typeof volumePolicySchema>;

export const inclusionPolicySchema = z.enum(['vendable_separement', 'inclus_uniquement']);
export type InclusionPolicy = z.infer<typeof inclusionPolicySchema>;

export const directionApprovalStatusSchema = z.enum(['APPROVED', 'DIRECTION_A_VALIDER']);
export type DirectionApprovalStatus = z.infer<typeof directionApprovalStatusSchema>;

export const carteStatutExcluSchema = z.enum(['CONSERVEE', 'DISPENSEE', 'RECONDUITE']);

/**
 * Stable references into data/pricing.canonical.json::candidat_individuel_modules
 * (the existing rate table, reused — never a second price source). A module
 * never embeds a TND amount directly (mission §4).
 */
export const pricingRuleIdSchema = z.enum([
  'PILOTAGE_MONTHLY',
  'PETIT_GROUPE_4H',
  'PETIT_GROUPE_8H',
  'PETIT_GROUPE_12H',
  'DUO_HOUR',
  'INDIVIDUEL_HOUR_MIN',
]);
export type PricingRuleId = z.infer<typeof pricingRuleIdSchema>;

export const catalogueServiceSchema = z
  .object({
    serviceId: z.string().regex(/^SVC_[A-Z0-9_]+$/),
    label: z.string().trim().min(1),
    coverageKeys: z.array(z.string().min(1)).min(1),
    /** Points at candidat_individuel_modules (rate table) — null only when never separately priced. */
    pricingRuleId: pricingRuleIdSchema.nullable(),
    inclusionPolicy: inclusionPolicySchema,
    requiresHumanReview: z.boolean(),
    directionApprovalStatus: directionApprovalStatusSchema,
  })
  .strict();
export type CatalogueService = z.infer<typeof catalogueServiceSchema>;

export const catalogueModuleSchema = z
  .object({
    moduleId: z.string().regex(/^MOD_[A-Z0-9_]+$/),
    label: z.string().trim().min(1),
    /** References lib/exams/ épreuve ids (the main `epreuves[]` array) — never redefined here. Empty for an options-only module. */
    epreuveCodes: z.array(z.string().min(1)),
    /** References lib/exams/options.ts option codes (a distinct vocabulary from épreuve ids — options are never in `epreuves[]`). Empty for an épreuve-only module. */
    optionCodes: z.array(z.string().min(1)),
    /** EpreuveStatut values under which this module is excluded (confirmed, not merely declared/uncertain). Only meaningful when epreuveCodes is non-empty. */
    statutsCarteExclus: z.array(carteStatutExcluSchema),
    /** True when the module stays relevant even under an excluded statut (e.g. EAF descriptif despite a dispense). */
    utileMalgreDispense: z.boolean(),
    deliveryMode: deliveryModeSchema,
    coverageKey: z.string().min(1),
    pricingRuleId: pricingRuleIdSchema.nullable(),
    volumePolicy: volumePolicySchema,
    inclusionPolicy: inclusionPolicySchema,
    requiresHumanReview: z.boolean(),
    directionApprovalStatus: directionApprovalStatusSchema,
  })
  .strict()
  .refine((m) => m.epreuveCodes.length > 0 || m.optionCodes.length > 0, {
    message: 'a module must reference at least one épreuve or option code',
  });
export type CatalogueModule = z.infer<typeof catalogueModuleSchema>;

export const candidatIndividuelCatalogueSchema = z
  .object({
    version: z.string().trim().min(1),
    modalites: z.array(deliveryModeSchema).min(1),
    services: z.array(catalogueServiceSchema).min(1),
    modules: z.array(catalogueModuleSchema).min(1),
  })
  .strict()
  .superRefine((catalogue, ctx) => {
    const serviceIds = catalogue.services.map((s) => s.serviceId);
    const dupServiceIds = serviceIds.filter((id, i) => serviceIds.indexOf(id) !== i);
    if (dupServiceIds.length > 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate serviceId: ${dupServiceIds.join(', ')}` });
    }

    const moduleIds = catalogue.modules.map((m) => m.moduleId);
    const dupModuleIds = moduleIds.filter((id, i) => moduleIds.indexOf(id) !== i);
    if (dupModuleIds.length > 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate moduleId: ${dupModuleIds.join(', ')}` });
    }

    const allCoverageKeys = [
      ...catalogue.services.flatMap((s) => s.coverageKeys),
      ...catalogue.modules.map((m) => m.coverageKey),
    ];
    const dupCoverageKeys = allCoverageKeys.filter((k, i) => allCoverageKeys.indexOf(k) !== i);
    if (dupCoverageKeys.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `duplicate coverageKey (a coverage key must identify exactly one sellable unit): ${[...new Set(dupCoverageKeys)].join(', ')}`,
      });
    }

    for (const m of catalogue.modules) {
      if (!catalogue.modalites.includes(m.deliveryMode)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `module ${m.moduleId}: deliveryMode "${m.deliveryMode}" is not declared in modalites`,
        });
      }
      if (m.volumePolicy.kind === 'direction_a_valider' && m.directionApprovalStatus !== 'DIRECTION_A_VALIDER') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `module ${m.moduleId}: volumePolicy is direction_a_valider but directionApprovalStatus is not — a module without an approved volume can never claim APPROVED status`,
        });
      }
      if (m.directionApprovalStatus === 'DIRECTION_A_VALIDER' && m.pricingRuleId != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `module ${m.moduleId}: directionApprovalStatus is DIRECTION_A_VALIDER but pricingRuleId is set — an unapproved module must never carry a price (mission §2 règle de blocage)`,
        });
      }
    }
  });
export type CandidatIndividuelCatalogue = z.infer<typeof candidatIndividuelCatalogueSchema>;
