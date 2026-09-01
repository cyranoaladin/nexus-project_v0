/**
 * Derives which épreuves apply to a candidate's situation, and their
 * coefficients — from the versioned exam-rules catalog only, never
 * hardcoded (CDC §12/§13). Pure, no React, no DB.
 */
import { requireExamPolicy, checkSameSessionEligibility, type EligibilityAnswers as ExamEligibilityAnswers } from '@/lib/exams/catalog';
import type { ExamPolicy } from '@/lib/exams/schema';
import type { BacAccelereEligibilityOutcome, SituationInput, SubjectId } from './schemas';
import { SUBJECT_LABELS } from './subject-labels';

export { SUBJECT_LABELS };

export interface ExamProfileSubject {
  subject: SubjectId;
  label: string;
  epreuveIds: string[];
  coefficient: number;
  /**
   * true for subjects that are, by default, worth a regular weekly/monthly
   * accompaniment (anticipées, EDS conservées, philosophie, Grand Oral).
   * false for ponctuelle-only subjects (HG, LVA, LVB, enseignement
   * scientifique, spécialité abandonnée) — these only enter the
   * recommendation when the diagnostic flags a real, specific weakness
   * (CDC §18: "ne jamais ajouter des heures uniquement pour augmenter le
   * panier").
   */
  defaultCandidateForRegularSupport: boolean;
}

export function buildExamProfile(situation: SituationInput): ExamProfileSubject[] {
  const policy = requireExamPolicy(situation.examSession);
  const byId = new Map(policy.epreuves.map((e) => [e.id, e]));
  const coef = (id: string) => {
    const e = byId.get(id);
    if (!e) throw new Error(`Unknown epreuve id "${id}" for session ${situation.examSession}`);
    return e.coefficient;
  };

  if (situation.level === 'premiere') {
    return [
      {
        subject: 'francais',
        label: 'Français / EAF',
        epreuveIds: ['eaf-ecrit', 'eaf-oral'],
        coefficient: coef('eaf-ecrit') + coef('eaf-oral'),
        defaultCandidateForRegularSupport: true,
      },
      {
        subject: 'maths-anticipees',
        label: 'Mathématiques anticipées',
        epreuveIds: ['eam'],
        coefficient: coef('eam'),
        defaultCandidateForRegularSupport: true,
      },
    ];
  }

  const subjects: ExamProfileSubject[] = [
    {
      subject: 'eds1',
      label: SUBJECT_LABELS[situation.specialites[0]],
      epreuveIds: ['eds1'],
      coefficient: coef('eds1'),
      defaultCandidateForRegularSupport: true,
    },
    {
      subject: 'eds2',
      label: SUBJECT_LABELS[situation.specialites[1]],
      epreuveIds: ['eds2'],
      coefficient: coef('eds2'),
      defaultCandidateForRegularSupport: true,
    },
    {
      subject: 'philosophie',
      label: 'Philosophie',
      epreuveIds: ['philosophie'],
      coefficient: coef('philosophie'),
      defaultCandidateForRegularSupport: true,
    },
    {
      subject: 'grand-oral',
      label: 'Grand Oral',
      epreuveIds: ['grand-oral'],
      coefficient: coef('grand-oral'),
      defaultCandidateForRegularSupport: true,
    },
    {
      subject: 'histoire-geographie',
      label: 'Histoire-Géographie',
      epreuveIds: ['histoire-geographie'],
      coefficient: coef('histoire-geographie'),
      defaultCandidateForRegularSupport: false,
    },
    {
      subject: 'lva',
      label: 'Langue vivante A',
      epreuveIds: ['lva'],
      coefficient: coef('lva'),
      defaultCandidateForRegularSupport: false,
    },
    {
      subject: 'lvb',
      label: 'Langue vivante B',
      epreuveIds: ['lvb'],
      coefficient: coef('lvb'),
      defaultCandidateForRegularSupport: false,
    },
    {
      subject: 'enseignement-scientifique',
      label: 'Enseignement scientifique',
      epreuveIds: ['enseignement-scientifique'],
      coefficient: coef('enseignement-scientifique'),
      defaultCandidateForRegularSupport: false,
    },
  ];

  if (situation.specialiteAbandonnee) {
    subjects.push({
      subject: 'specialite-abandonnee',
      label: `${SUBJECT_LABELS[situation.specialiteAbandonnee]} (spécialité de première non poursuivie)`,
      epreuveIds: ['specialite-abandonnee'],
      coefficient: coef('specialite-abandonnee'),
      defaultCandidateForRegularSupport: false,
    });
  }

  return subjects;
}

export function checkBacAccelereEligibility(
  examSession: number,
  answers: ExamEligibilityAnswers,
): BacAccelereEligibilityOutcome {
  const policy = requireExamPolicy(examSession);
  return checkSameSessionEligibility(policy, answers).outcome;
}

export function getExamPolicyVersion(policy: ExamPolicy): string {
  return `${policy.session}@${policy.lastVerifiedAt}`;
}
