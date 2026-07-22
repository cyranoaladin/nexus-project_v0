/**
 * ÉTAPE A.2 — Audit executable des operationalGates du planning pré-rentrée 2026.
 *
 * Ce test EXÉCUTE la validation des gates sur les données réelles du manifeste,
 * là où le schéma se contentait de stocker des booléens sans les recalculer.
 * Il ajoute un 4e contrôle absent du schéma : noLevelConflict.
 *
 * Fichier d'audit — ne modifie aucune source. À conserver ou retirer selon décision.
 */
import manifest from '@/data/campaigns/pre-rentree-2026.json';

type Slot = {
  level: string;
  subject: string;
  block: string;
  room: string;
  teacherRole: string;
};
type Week = { week: number; slots: Slot[] };

const schedule = manifest.schedule as unknown as Week[];
const BLOCK_HOURS = 2; // chaque bloc dure 2h (08:30-10:30, etc.)
const MAX_HOURS_PER_DAY = 6;

/** Regroupe une clé -> occurrences pour détecter les collisions. */
function duplicates<T>(items: T[]): T[] {
  const seen = new Set<string>();
  const dups: T[] = [];
  for (const item of items) {
    const key = JSON.stringify(item);
    if (seen.has(key)) dups.push(item);
    seen.add(key);
  }
  return dups;
}

describe('Pré-rentrée 2026 — operationalGates recalculés sur données réelles', () => {
  it('noRoomConflict : aucune salle occupée deux fois sur le même bloc/semaine', () => {
    for (const week of schedule) {
      const pairs = week.slots.map((s) => ({ w: week.week, room: s.room, block: s.block }));
      expect(duplicates(pairs)).toEqual([]);
    }
  });

  it('noTeacherConflict : aucun rôle enseignant sur deux créneaux du même bloc/semaine', () => {
    for (const week of schedule) {
      const pairs = week.slots.map((s) => ({ w: week.week, teacher: s.teacherRole, block: s.block }));
      expect(duplicates(pairs)).toEqual([]);
    }
  });

  it('noLevelConflict (NOUVEAU) : aucun niveau avec deux matières sur le même bloc/semaine', () => {
    for (const week of schedule) {
      const pairs = week.slots.map((s) => ({ w: week.week, level: s.level, block: s.block }));
      expect(duplicates(pairs)).toEqual([]);
    }
  });

  it('dailyLoadValid : chaque niveau ET chaque enseignant restent <= 6h/jour', () => {
    for (const week of schedule) {
      const byLevel: Record<string, number> = {};
      const byTeacher: Record<string, number> = {};
      for (const s of week.slots) {
        byLevel[s.level] = (byLevel[s.level] ?? 0) + BLOCK_HOURS;
        byTeacher[s.teacherRole] = (byTeacher[s.teacherRole] ?? 0) + BLOCK_HOURS;
      }
      for (const hours of Object.values(byLevel)) expect(hours).toBeLessThanOrEqual(MAX_HOURS_PER_DAY);
      for (const hours of Object.values(byTeacher)) expect(hours).toBeLessThanOrEqual(MAX_HOURS_PER_DAY);
    }
  });

  it('les booléens operationalGates du manifeste correspondent au calcul réel', () => {
    const gates = manifest.operationalGates as Record<string, boolean>;
    expect(gates.noRoomConflict).toBe(true);
    expect(gates.noTeacherConflict).toBe(true);
    expect(gates.dailyLoadValid).toBe(true);
  });

  it('la SVT est bien planifiée pour Première ET Terminale', () => {
    const svt = schedule.flatMap((w) => w.slots).filter((s) => s.subject === 'SVT');
    const levels = new Set(svt.map((s) => s.level));
    expect(levels.has('PREMIERE')).toBe(true);
    expect(levels.has('TERMINALE')).toBe(true);
    // Constat factuel : la SVT est placée sur le bloc E (18:00-20:00), 5e créneau du soir.
    expect(new Set(svt.map((s) => s.block))).toEqual(new Set(['E']));
  });
});
