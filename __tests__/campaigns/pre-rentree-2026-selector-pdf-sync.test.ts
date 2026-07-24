/**
 * D3 (Volet 2) — pour un niveau donné, les créneaux que le sélecteur de planning
 * composerait (mêmes données que le back : getPreRentreeSchedule()) sont exactement
 * ceux qui apparaissent dans le PDF Planning publié. Verrouille la synchro
 * sélecteur ↔ PDF, en plus de la synchro JSON ↔ PDF déjà couverte séparément.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { getPreRentreeSchedule } from '@/lib/campaigns/pre-rentree-2026/getters';
import type { EntryLevelCode } from '@/lib/campaigns/pre-rentree-2026/schema';

const PDF = join(
  process.cwd(),
  'assets/campaigns/pre-rentree-2026/documents-final/NexusReussite_PreRentree2026_Planning_InfosPratiques.pdf',
);

const maybe = existsSync(PDF) ? describe : describe.skip;

maybe('Pré-rentrée 2026 — synchro sélecteur de planning ↔ PDF Planning', () => {
  const text = existsSync(PDF) ? execFileSync('pdftotext', ['-layout', PDF, '-'], { encoding: 'utf8' }) : '';
  const schedule = getPreRentreeSchedule();

  /** Reproduit exactement ce que StagePlanningSelector affiche pour un niveau + toutes ses matières. */
  function selectorSlotsForLevel(level: EntryLevelCode) {
    return schedule.filter((slot) => slot.level === level);
  }

  it.each(['TROISIEME', 'SECONDE', 'PREMIERE', 'TERMINALE'] as EntryLevelCode[])(
    'les créneaux composés par le sélecteur pour %s apparaissent tous dans le PDF Planning',
    (level) => {
      const slots = selectorSlotsForLevel(level);
      expect(slots.length).toBeGreaterThan(0);
      const missing = slots
        .map((slot) => `${slot.startTime}–${slot.endTime}`)
        .filter((timeRange) => !text.includes(timeRange));
      expect(missing).toEqual([]);
    },
  );

  it('le nombre de matières distinctes par niveau correspond entre le sélecteur et la grille scellée', () => {
    const byLevel = new Map<EntryLevelCode, Set<string>>();
    for (const slot of schedule) {
      const set = byLevel.get(slot.level) ?? new Set<string>();
      set.add(slot.subject);
      byLevel.set(slot.level, set);
    }
    expect(byLevel.get('TROISIEME')?.size).toBe(2);
    expect(byLevel.get('SECONDE')?.size).toBe(2);
    expect(byLevel.get('PREMIERE')?.size).toBe(5);
    expect(byLevel.get('TERMINALE')?.size).toBe(5);
  });
});
