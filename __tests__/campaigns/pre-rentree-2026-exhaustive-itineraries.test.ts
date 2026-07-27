import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assignItinerary,
  enumerateSelections,
} from '@/lib/campaigns/pre-rentree-2026/itinerary';
import {
  buildStageAvailabilityMessage,
} from '@/lib/campaigns/pre-rentree-2026/availability-message';
import {
  getPreRentreeCampaign,
  getPreRentreeSchedule,
  getPreRentreeOfferOptions,
} from '@/lib/campaigns/pre-rentree-2026/getters';
import type { EntryLevelCode } from '@/lib/campaigns/pre-rentree-2026/schema';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

const campaign = getPreRentreeCampaign();
const dto = {
  levels: campaign.levels,
  subjects: campaign.subjects,
  schedule: getPreRentreeSchedule(),
  offerOptions: getPreRentreeOfferOptions(),
};
const levels = [
  'TROISIEME',
  'SECONDE',
  'PREMIERE',
  'TERMINALE',
] as const satisfies readonly EntryLevelCode[];
const actionableStatuses = new Set(['COMPACT', 'NO_SHARED_DAY']);

function subjectIds(level: EntryLevelCode): string[] {
  return dto.subjects
    .filter((subject) => subject.levels.includes(level))
    .map((subject) => subject.id);
}

describe('Pré-rentrée 2026 — exhaustive public itinerary matrix', () => {
  it('qualifies every 1–4 subject combination deterministically', () => {
    let combinationCount = 0;
    let actionableCount = 0;

    for (const level of levels) {
      for (const subjects of enumerateSelections(subjectIds(level), 4)) {
        combinationCount += 1;
        const first = assignItinerary(level, subjects, dto.schedule);
        const second = assignItinerary(level, subjects, dto.schedule);
        expect(second).toEqual(first);

        for (const subject of subjects) {
          const sessions = first.sessionsBySubject[subject];
          expect(sessions).toHaveLength(5);
          expect(
            sessions?.every((session) => {
              const [startHour, startMinute] = session.startTime.split(':').map(Number);
              const [endHour, endMinute] = session.endTime.split(':').map(Number);
              return (
                endHour * 60 + endMinute - (startHour * 60 + startMinute) ===
                120
              );
            }),
          ).toBe(true);
        }

        const actionable = actionableStatuses.has(first.itinerary.status);
        if (actionable) {
          actionableCount += 1;
          expect(first.itinerary.maxIdleMinutes).toBeLessThanOrEqual(60);
        } else {
          expect(first.itinerary.firstConflict).not.toBeNull();
        }

        const pack = dto.offerOptions.find(
          (candidate) =>
            candidate.level === level &&
            candidate.subjectsCount === subjects.length,
        );
        expect(pack).toBeDefined();
        const message = buildStageAvailabilityMessage({
          level,
          levels: dto.levels,
          subjects: dto.subjects,
          selectedSubjectIds: subjects,
          assignment: first,
          totalHours: pack!.totalHours,
        });
        expect(message).toContain('sous réserve de places disponibles');
        expect(message).toContain('Profil :');
        expect(message).toContain('Dates :');
        expect(message).toContain('Horaire :');
        expect(message).toContain('Cohorte proposée :');
        for (const subject of subjects) {
          const publicSubject = dto.subjects.find((candidate) => candidate.id === subject);
          expect(message).toContain(
            publicSubject?.labelByLevel?.[level] ?? publicSubject?.label,
          );
        }
        expect(buildWhatsAppUrl(message, { exactMessage: true })).toMatch(
          /^https:\/\/wa\.me\/21699192829\?text=/,
        );
      }
    }

    // 92, pas 66 : Terminale passe de 5 à 6 matières (Philosophie s'ajoute au
    // pool) — C(6,1..4) = 6+15+20+15 = 56 au lieu de C(5,1..4) = 30 pour ce
    // niveau seul ; 3e/Seconde/Première inchangés (3+3+30). 3+3+30+56 = 92.
    expect(combinationCount).toBe(92);
    expect(actionableCount).toBeGreaterThan(0);
    expect(actionableCount).toBeLessThanOrEqual(combinationCount);
  });

  it('keeps the committed machine-readable matrix synchronized', () => {
    const matrix = JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          'assets/campaigns/pre-rentree-2026/schedule-optimization/selection-matrix-final.json',
        ),
        'utf8',
      ),
    );
    expect(matrix.schemaVersion).toBe('1.0.0');
    expect(matrix.summary.combinationCount).toBe(92);
    expect(matrix.rows).toHaveLength(92);
    expect(
      matrix.rows.every(
        (row: { actionable: boolean; status: string; maxIdleMinutes: number }) =>
          row.actionable
            ? actionableStatuses.has(row.status) && row.maxIdleMinutes <= 60
            : !actionableStatuses.has(row.status),
      ),
    ).toBe(true);
  });
});
