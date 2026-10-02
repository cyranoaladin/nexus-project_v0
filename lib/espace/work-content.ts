/**
 * Contenu d'un travail d'élève (colonne JSON `EspaceWork.content`).
 *
 * Forme : { v: 1, steps: { [stepId]: { code?, fields?, choices?, tests? } } }
 * Le serveur ne fait confiance à rien : tout passe par ce schéma strict, avec
 * des plafonds de taille, avant d'atteindre la base. Le code Python est une
 * simple chaîne ; il n'est jamais exécuté côté serveur.
 */
import { z } from 'zod';

export const MAX_CODE_CHARS = 20_000;
export const MAX_FIELD_CHARS = 5_000;
export const MAX_STEPS = 16;
export const MAX_ITEMS_PER_STEP = 24;
export const MAX_CONTENT_BYTES = 256 * 1024;

export class WorkContentError extends Error {
  readonly code = 'INVALID_CONTENT';
  constructor(message: string) {
    super(message);
    this.name = 'WorkContentError';
  }
}

const idKey = z.string().min(1).max(64).regex(/^[A-Za-z0-9_.-]+$/);

const testResultSchema = z
  .object({
    ranAt: z.string().max(40),
    passed: z.number().int().min(0).max(1000),
    total: z.number().int().min(0).max(1000),
  })
  .strict();

export const stepContentSchema = z
  .object({
    code: z.string().max(MAX_CODE_CHARS).optional(),
    fields: z.record(idKey, z.string().max(MAX_FIELD_CHARS)).optional(),
    choices: z.record(idKey, z.number().int().min(0).max(32)).optional(),
    tests: testResultSchema.optional(),
  })
  .strict()
  .superRefine((step, ctx) => {
    if (Object.keys(step.fields ?? {}).length > MAX_ITEMS_PER_STEP || Object.keys(step.choices ?? {}).length > MAX_ITEMS_PER_STEP) {
      ctx.addIssue({ code: 'custom', message: 'Trop d’éléments dans l’étape' });
    }
  });

export const workContentSchema = z
  .object({
    v: z.literal(1),
    steps: z.record(idKey, stepContentSchema).refine((s) => Object.keys(s).length <= MAX_STEPS, 'Trop d’étapes'),
  })
  .strict();

export type StepContent = z.infer<typeof stepContentSchema>;
export type WorkContent = z.infer<typeof workContentSchema>;

export const EMPTY_WORK_CONTENT: WorkContent = Object.freeze({ v: 1, steps: Object.freeze({}) }) as WorkContent;

export function parseWorkContent(raw: unknown): WorkContent {
  if (raw === undefined || raw === null) return { v: 1, steps: {} };
  if (typeof raw === 'object' && Object.keys(raw as object).length === 0) return { v: 1, steps: {} };
  const parsed = workContentSchema.safeParse(raw);
  if (!parsed.success) throw new WorkContentError('Contenu de travail invalide');
  if (Buffer.byteLength(JSON.stringify(parsed.data), 'utf8') > MAX_CONTENT_BYTES) {
    throw new WorkContentError('Contenu de travail trop volumineux');
  }
  return parsed.data;
}

export interface StepPatch {
  stepId: string;
  step: StepContent;
}

export function parseStepPatch(raw: unknown, allowedStepIds: readonly string[]): StepPatch {
  const parsed = z.object({ stepId: idKey, step: stepContentSchema }).strict().safeParse(raw);
  if (!parsed.success) throw new WorkContentError('Étape invalide');
  if (!allowedStepIds.includes(parsed.data.stepId)) throw new WorkContentError('Étape inconnue');
  return parsed.data;
}

/** Remplace une seule étape ; ne modifie jamais l'objet d'entrée. */
export function mergeStep(content: WorkContent, stepId: string, step: StepContent): WorkContent {
  return { v: 1, steps: { ...content.steps, [stepId]: step } };
}

interface StepDefinition {
  id: string;
  starter: string | null;
  questions: { id: string; choices: string[] }[];
  fields: { id: string }[];
}

/**
 * Une étape est « renseignée » quand toutes ses questions ont un choix valide,
 * tous ses champs ont du texte, et — si elle propose un code de départ — que
 * le code a été modifié. Ce n'est PAS une évaluation : c'est un indicateur de
 * progression ; la correction qualitative reste celle de l'enseignant.
 */
export function isStepComplete(def: StepDefinition, step: StepContent | undefined): boolean {
  if (!step) return false;
  for (const q of def.questions) {
    const picked = step.choices?.[q.id];
    if (typeof picked !== 'number' || picked < 0 || picked >= q.choices.length) return false;
  }
  for (const f of def.fields) {
    if (!(step.fields?.[f.id] ?? '').trim()) return false;
  }
  const starter = (def.starter ?? '').trim();
  if (starter) {
    const code = (step.code ?? '').trim();
    if (!code || code === starter) return false;
  }
  return true;
}

const OPTIONAL = new Set(['bonus']);

export function computeProgress(
  defs: readonly StepDefinition[],
  content: WorkContent,
): { completedSteps: number; requiredSteps: number } {
  const required = defs.filter((d) => !OPTIONAL.has(d.id));
  const completedSteps = required.filter((d) => isStepComplete(d, content.steps[d.id])).length;
  return { completedSteps, requiredSteps: required.length };
}
