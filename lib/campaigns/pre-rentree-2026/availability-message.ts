import { formatDetailedDates } from './presentation';
import type { LandingLevel } from './configurator';
import type { AssignmentResult } from './itinerary';
import type {
  PublicScheduleSubject,
} from './public-schedule';
import type { EntryLevelCode } from './schema';

function subjectLabelForLevel(
  subject: PublicScheduleSubject,
  level: EntryLevelCode,
): string {
  return subject.labelByLevel?.[level] ?? subject.label;
}

/**
 * Builds the exact parent-facing availability request from one resolved
 * itinerary. It deliberately contains no room, capacity promise, teacher or
 * governance field.
 */
export function buildStageAvailabilityMessage({
  level,
  levels,
  subjects,
  selectedSubjectIds,
  assignment,
  totalHours,
}: {
  level: EntryLevelCode;
  levels: readonly LandingLevel[];
  subjects: readonly PublicScheduleSubject[];
  selectedSubjectIds: readonly string[];
  assignment: AssignmentResult;
  totalHours: number;
}): string {
  const levelLabel =
    levels.find((candidate) => candidate.id === level)?.label ?? level;
  const subjectLines = selectedSubjectIds.map((subjectId) => {
    const subject = subjects.find((candidate) => candidate.id === subjectId);
    const label = subject
      ? subjectLabelForLevel(subject, level)
      : subjectId;
    const sessions = assignment.sessionsBySubject[subjectId] ?? [];
    const first = sessions[0];
    const subjectDates = [...new Set(sessions.map((session) => session.date))].sort();
    return [
      `- ${label}`,
      `  Dates : ${subjectDates.map((date) => formatDetailedDates([date])).join(', ')}`,
      `  Horaire : ${first ? `${first.startTime}–${first.endTime}` : 'à confirmer'}`,
      `  Cohorte proposée : ${first ? `créneau ${first.block}` : 'à confirmer'}`,
    ].join('\n');
  });

  return [
    'Bonjour Nexus Réussite,',
    'Je souhaite demander les informations et vérifier les disponibilités pour la pré-rentrée 2026.',
    '',
    `Niveau : ${levelLabel}`,
    'Profil : à confirmer lors de l’échange',
    `Matières (${selectedSubjectIds.length}) :`,
    ...subjectLines,
    `Volume : ${totalHours} heures`,
    `Attente maximale : ${assignment.itinerary.maxIdleMinutes} minutes`,
    '',
    'Itinéraire proposé sous réserve de places disponibles.',
  ].join('\n');
}
