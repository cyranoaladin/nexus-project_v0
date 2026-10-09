import { z } from 'zod';

import { bilanData, getBilanLesson, getBilanSections, getExclusiveBilanChoices, getEligibleBilanTasks, getBilanMastery, isBilanMasteryStep, type BilanLevel } from './bilan-data';
import { EspaceError } from './errors';
import { MAX_FIELD_CHARS, type StepContent, type WorkContent } from './work-content';

const evidenceSchema = z.object({
  answer: z.string().max(MAX_FIELD_CHARS).optional(),
  aid: z.string().max(160).optional(),
  retry: z.string().max(MAX_FIELD_CHARS).optional(),
  skipped: z.boolean().optional(),
  confidence: z.enum(['Faible', 'Moyenne', 'Forte', 'Je ne souhaite pas répondre']).optional(),
  conditions: z.enum(['Sans cours ni calculatrice', 'Avec les outils autorisés par l’énoncé', 'Avec une aide ou une ressource', 'Je ne sais plus', 'Je ne souhaite pas répondre']).optional(),
}).strict();
const DECLINED = 'Je ne souhaite pas répondre';

function invalid(message = 'Réponse de bilan invalide'): never {
  throw new EspaceError('INVALID_INPUT', message);
}
function json(raw: string): unknown {
  try { return JSON.parse(raw); } catch { return invalid(); }
}

/** Les bilans contiennent des déclarations, jamais des notes ni des validations enseignantes. */
export function validateBilanStep(level: BilanLevel, stepId: string, step: StepContent): void {
  const def = getBilanLesson(level).steps.find(s => s.id === stepId);
  if (!def || Object.keys(step).some(key => key !== 'fields')) invalid();
  const allowed = new Set(def.fields.map(f => f.id));
  const entries = Object.entries(step.fields ?? {});
  if (stepId === 'evidence' && entries.filter(([, value]) => value.trim()).length > 2) {
    invalid('Choisis deux essais au maximum');
  }
  for (const [id, value] of entries) {
    if (!allowed.has(id) || value.length > MAX_FIELD_CHARS) invalid();
    if (!value.trim()) continue; // Une réponse omise n’est pas un échec.
    if (stepId === 'scope') {
      if (id !== 'other' && !['yes', 'no', 'unsure'].includes(value)) invalid();
    } else if (isBilanMasteryStep(stepId)) {
      if (!Object.hasOwn(bilanData.mastery, value)) invalid();
    } else if (stepId === 'evidence') {
      if (!evidenceSchema.safeParse(json(value)).success) invalid();
    } else if (stepId === 'review') {
      if (!['yes', 'no'].includes(value)) invalid();
    } else {
      const question = getBilanSections(level).find(s => s.id === stepId)?.questions.find(q => q.id === id);
      if (!question) invalid();
      if ((question.type === 'radio' || question.type === 'scale') && value !== DECLINED && !question.options?.includes(value)) invalid();
      if (question.type === 'multi') {
        const choices = json(value);
        if (!Array.isArray(choices) || choices.length > (question.max ?? 3) || new Set(choices).size !== choices.length || choices.some(choice => typeof choice !== 'string' || (choice !== DECLINED && !question.options?.includes(choice)))) invalid();
        if (choices.length > 1 && choices.some(choice => getExclusiveBilanChoices(question).includes(choice))) invalid();
      }
    }
  }
}

/** Un changement de parcours retire les essais désormais hors périmètre, sans bloquer la sauvegarde. */
export function normalizeBilanContent(level: BilanLevel, content: WorkContent): WorkContent {
  for (const [id, step] of Object.entries(content.steps)) validateBilanStep(level, id, step);
  const steps = { ...content.steps };
  for (const section of getBilanSections(level)) {
    const fields = steps[section.id]?.fields;
    if (!fields) continue;
    for (const q of section.questions.filter(q => q.priorityOf)) {
      const value = fields[q.id];
      if (!value || value === DECLINED) continue;
      const raw = fields[q.priorityOf!];
      const selected: unknown = raw?.trim() ? json(raw) : [];
      if (!Array.isArray(selected) || !selected.includes(value)) {
        steps[section.id] = { fields: { ...steps[section.id].fields, [q.id]: '' } };
      }
    }
  }
  if (steps.evidence) {
    const eligible = new Set(getEligibleBilanTasks(level, steps.scope?.fields ?? {}, getBilanMastery(steps)).map(t => t.id));
    steps.evidence = { fields: Object.fromEntries(Object.entries(steps.evidence.fields ?? {}).filter(([id, value]) => eligible.has(id) && value.trim())) };
  }
  return { ...content, steps };
}

export function assertBilanReadyToSubmit(level: BilanLevel, content: WorkContent): void {
  normalizeBilanContent(level, content);
  if (content.steps.review?.fields?.confirmed !== 'yes') invalid('Relis tes réponses puis confirme avant de transmettre ton bilan');
}

export function computeBilanProgress(level: BilanLevel, content: WorkContent) {
  const normalized = normalizeBilanContent(level, content);
  const defs = getBilanLesson(level).steps;
  return {
    // Étapes renseignées, pas compétences réussies : toutes les réponses restent facultatives.
    completedSteps: defs.filter(step => Object.values(normalized.steps[step.id]?.fields ?? {}).some(value => value.trim())).length,
    requiredSteps: defs.length,
  };
}
