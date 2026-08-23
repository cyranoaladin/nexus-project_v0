/**
 * Group / duo / individuel modality decision from real enrollment counts
 * (CDC §22). Pure — the caller supplies the actual enrolled count (read
 * from the existing Group/enrollment models); this module never queries
 * the DB itself and never promises a place that doesn't exist. Never
 * exposes other students' identities — only a count in, a modality out.
 */
import { getCandidatIndividuelModules } from '@/lib/pricing';
import type { RecommendedLine } from './schemas';

export type GroupAvailabilityDecision = 'GROUPE' | 'DUO' | 'INDIVIDUEL_OR_WAITLIST';

/** >= 3 enrolled: group opens. Exactly 2: propose duo. 0-1: individuel or wait for another créneau. */
export function decideModality(enrolledCount: number): GroupAvailabilityDecision {
  if (enrolledCount >= 3) return 'GROUPE';
  if (enrolledCount === 2) return 'DUO';
  return 'INDIVIDUEL_OR_WAITLIST';
}

/**
 * Re-prices a GROUPE line if the real enrolled count can't support a
 * group, falling back to duo (90 TND/h/élève) or the individuel floor
 * (>= 180 TND/h). Leaves non-GROUPE lines (Pilotage, Grand Oral, PACK)
 * untouched.
 */
export function applyGroupAvailability(line: RecommendedLine, enrolledCount: number): RecommendedLine {
  if (line.modality !== 'GROUPE' || line.hoursPerMonth == null) return line;

  const decision = decideModality(enrolledCount);
  if (decision === 'GROUPE') return line;

  const modules = getCandidatIndividuelModules();

  if (decision === 'DUO') {
    const unitPriceMonthly = modules.duo.price_per_hour_per_student * line.hoursPerMonth;
    return {
      ...line,
      modality: 'DUO',
      unitPriceMonthly,
      reason: `${line.reason} Groupe non ouvert actuellement (2 inscrits) — proposé en duo.`,
    };
  }

  const unitPriceMonthly = modules.individuel.price_per_hour_min * line.hoursPerMonth;
  return {
    ...line,
    modality: 'INDIVIDUEL',
    unitPriceMonthly,
    reason: `${line.reason} Groupe non ouvert actuellement — proposé en individuel, ou en attente d'un autre créneau.`,
  };
}
