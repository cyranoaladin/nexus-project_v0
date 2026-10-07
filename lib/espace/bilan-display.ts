import { bilanData, getBilanLesson, type BilanLevel } from './bilan-data';
import type { ViewerStepDef } from '@/components/espace/teacher/WorkViewer';

export type BilanAnswerFormat = 'scope' | 'mastery' | 'evidence' | 'multi' | 'review';

/** Texte uniquement. React reste responsable de l’échappement, y compris dans le rapport imprimé. */
export function formatBilanAnswer(format: BilanAnswerFormat | undefined, raw: string): string {
  if (!raw.trim()) return '';
  if (format === 'scope') return ({ yes: 'Travaillé en séance (déclaration de l’élève)', no: 'Non travaillé', unsure: 'À confirmer : l’élève ne se souvient plus' })[raw] ?? raw;
  if (format === 'mastery') return bilanData.mastery[raw] ?? raw;
  if (format === 'review') return raw === 'yes' ? 'L’élève confirme avoir relu ses réponses.' : 'Relecture non confirmée';
  if (format === 'multi') { try { const values: unknown = JSON.parse(raw); if (Array.isArray(values)) return values.filter(x => typeof x === 'string').join(' ; '); } catch { /* conserver la réponse lisible */ } }
  if (format === 'evidence') {
    try {
      const value = JSON.parse(raw) as Record<string, unknown>;
      if (!value || typeof value !== 'object') return 'Réponse à clarifier avec l’élève.';
      if (value.skipped === true) return 'Essai non fait — aucune conclusion de maîtrise.';
      const text = (key: string) => typeof value[key] === 'string' ? value[key] as string : '';
      return [`Premier essai : ${text('answer') || 'non renseigné'}`, `Aide déclarée : ${text('aid') || 'non précisée'}`, ...(text('retry') ? [`Après aide ou reprise : ${text('retry')}`] : [])].join('\n\n');
    } catch { return 'Réponse à clarifier avec l’élève.'; }
  }
  return raw;
}

export function bilanViewerSteps(level: BilanLevel): ViewerStepDef[] {
  return getBilanLesson(level).steps.map(s => ({
    id: s.id, title: s.title, short: 'Bilan', starter: null, questions: [],
    fields: s.fields.map(f => {
      const question = bilanData.sections.find(section => section.id === s.id)?.questions.find(q => q.id === f.id);
      const format: BilanAnswerFormat | undefined = s.id === 'scope' && f.id !== 'other' ? 'scope' : s.id === 'mastery' ? 'mastery' : s.id === 'evidence' ? 'evidence' : s.id === 'review' ? 'review' : question?.type === 'multi' ? 'multi' : undefined;
      const task = s.id === 'evidence' ? bilanData.tasks.find(t => t.id === f.id) : undefined;
      const skillModule = s.id === 'mastery' ? bilanData.modules[level].find(m => m.skills.some(skill => skill.id === f.id)) : undefined;
      return { id: f.id, label: task ? `${f.label} — ${task.prompt}` : f.label, format, scopeModule: task?.module ?? skillModule?.id, requiredSkills: task?.skills };
    }),
  }));
}
