import lexicon from '@/data/bilans/lexique-interdit.json';

import { validateDomainGrounding } from '../local-first/grounding';
import { scanPiiFields } from '../local-first/pii';
import { z } from 'zod';

import type { ValidatedPack } from './contracts';

export type ValidationRule = 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6' | 'V7';
export type ValidationFailure = Readonly<{ rule: ValidationRule; path: string; message: string }>;

const domainBlock = z.object({ domainId: z.string().trim().min(1), titre: z.string().trim().min(1) });
const bundleSchema = z.object({
  preAnalysis: z.object({
    synthese: z.string().trim().min(1),
    forcesPercues: z.array(z.string().trim().min(1)),
    craintes: z.array(z.string().trim().min(1)),
  }).strict(),
  eleve: z.object({
    accroche: z.string().trim().min(1),
    forces: z.array(z.string().trim().min(1)).length(3),
    priorites: z.array(domainBlock.extend({
      pourquoi: z.string().trim().min(1),
      comment: z.string().trim().min(1),
    }).strict()).min(1).max(50),
    microPlan: z.array(z.object({
      action: z.string().trim().min(1),
      dureeMin: z.number().int().positive(),
    }).strict()).min(1).max(5),
    motDeFin: z.string().trim().min(1),
  }).strict(),
  parents: z.object({
    cadre: z.string().trim().min(1),
    pointsAppui: z.array(z.object({
      domainId: z.string().trim().min(1),
      texte: z.string().trim().min(1),
    }).strict()).min(1).max(50),
    priorites: z.array(domainBlock.extend({
      ceQuiSeraFait: z.string().trim().min(1),
    }).strict()).min(1).max(50),
    etapeSuivante: z.object({ texte: z.string().trim().min(1), cta: z.string().trim().min(1) }).strict(),
  }).strict(),
  nexus: z.object({
    syntheseProfil: z.string().trim().min(1),
    diagnosticPedagogique: z.string().trim().min(1),
    planQuatreSemaines: z.string().trim().min(1),
    alertes: z.array(z.string()),
    ragReferences: z.array(z.string()),
  }).strict(),
  verifier: z.object({ ok: z.boolean(), violations: z.array(z.string()) }).strict(),
}).strict();

export type AgentBundle = z.infer<typeof bundleSchema>;

function collectStrings(value: unknown, path = '$'): Array<{ path: string; text: string }> {
  if (typeof value === 'string') return [{ path, text: value }];
  if (Array.isArray(value)) return value.flatMap((child, index) => collectStrings(child, `${path}[${index}]`));
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .flatMap(([key, child]) => collectStrings(child, `${path}.${key}`));
  }
  return [];
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
}

function failure(rule: ValidationRule, path: string, message: string): ValidationFailure {
  return Object.freeze({ rule, path, message });
}

export function validateAgentBundle(input: Readonly<{
  bundle: unknown;
  factSheet: Readonly<{ domains: readonly Readonly<{ id: string }>[] }>;
  pack: ValidatedPack;
}>): ValidationFailure[] {
  const parsed = bundleSchema.safeParse(input.bundle);
  if (!parsed.success) {
    return parsed.error.issues.map((issue) => failure('V1', issue.path.join('.'), issue.message));
  }
  const bundle = parsed.data;
  const failures: ValidationFailure[] = [];
  const publicStrings = collectStrings({ eleve: bundle.eleve, parents: bundle.parents });

  for (const field of publicStrings) {
    if (/\d/.test(field.text)) failures.push(failure('V2', field.path, 'Digit found in public prose'));
  }

  const allStrings = collectStrings(bundle);
  const forbiddenTerms = Object.values(lexicon.categories).flat();
  for (const field of allStrings) {
    const normalized = normalize(field.text);
    const term = forbiddenTerms.find((candidate) => normalized.includes(normalize(candidate)));
    if (term !== undefined) failures.push(failure('V3', field.path, 'Forbidden lexicon term'));
  }

  for (const issue of validateDomainGrounding(input.factSheet.domains.map(({ id }) => id), bundle)) {
    failures.push(failure('V4', issue.path, issue.message));
  }

  for (const field of publicStrings) {
    const publicText = normalize(field.text);
    for (const marker of ['les eleves', 'des eleves', 'vos enfants', 'tous les eleves']) {
      if (publicText.includes(marker)) failures.push(failure('V5', field.path, `Plural marker: ${marker}`));
    }
  }

  for (const field of allStrings) {
    const piiScan = scanPiiFields([{ ...field, source: 'LLM_GENERATED_TEXT' as const }]);
    if (piiScan.result.status !== 'CLEAN') {
      failures.push(failure('V6', field.path, 'Agent output crossed the PII boundary'));
    }
  }

  if (!lexicon.cta_autorises.includes(bundle.parents.etapeSuivante.cta)) {
    failures.push(failure('V7', 'parents.etapeSuivante.cta', 'CTA is not approved'));
  }
  if (bundle.verifier.ok === false) {
    failures.push(failure('V3', 'verifier', bundle.verifier.violations[0] ?? 'Verifier agent reported ok=false'));
  }
  if (input.pack.scoring.domains.length !== input.factSheet.domains.length) {
    failures.push(failure('V4', 'domains', 'Pack and FactSheet domain counts differ'));
  }
  return failures;
}
