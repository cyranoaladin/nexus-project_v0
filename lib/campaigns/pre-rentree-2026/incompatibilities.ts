import type { EntryLevelCode } from './schema';

export interface SubjectIncompatibility {
  level: EntryLevelCode;
  subjectA: string;
  subjectB: string;
}

interface DatedSlot {
  date: string;
  level: EntryLevelCode;
  subject: string;
  block: string;
}

/**
 * Two subjects of the same level are incompatible when they share a calendar date
 * and a time block: a student cannot physically attend both at once. Computed from
 * the expanded, dated schedule (not the raw window/slot grid) so that a block
 * letter reused across two non-overlapping windows (e.g. Première Français in
 * fenêtre 1 vs Physique-Chimie in the week-end window, both bloc B) is correctly
 * NOT flagged: their dates never actually coincide.
 */
export function computeSubjectIncompatibilities(sessions: readonly DatedSlot[]): SubjectIncompatibility[] {
  const byDateLevelBlock = new Map<string, Set<string>>();
  for (const session of sessions) {
    const key = `${session.date}__${session.level}__${session.block}`;
    const set = byDateLevelBlock.get(key) ?? new Set<string>();
    set.add(session.subject);
    byDateLevelBlock.set(key, set);
  }

  const pairs = new Map<string, SubjectIncompatibility>();
  for (const key of byDateLevelBlock.keys()) {
    const subjects = byDateLevelBlock.get(key)!;
    if (subjects.size < 2) continue;
    const [, level] = key.split('__');
    const subjectList = [...subjects].sort();
    for (let i = 0; i < subjectList.length; i += 1) {
      for (let j = i + 1; j < subjectList.length; j += 1) {
        const subjectA = subjectList[i]!;
        const subjectB = subjectList[j]!;
        const pairKey = `${level}|${subjectA}|${subjectB}`;
        if (!pairs.has(pairKey)) {
          pairs.set(pairKey, { level: level as EntryLevelCode, subjectA, subjectB });
        }
      }
    }
  }
  return [...pairs.values()];
}

export function areSubjectsIncompatible(
  incompatibilities: readonly SubjectIncompatibility[],
  level: EntryLevelCode,
  subjectA: string,
  subjectB: string,
): boolean {
  return incompatibilities.some((entry) => (
    entry.level === level
    && ((entry.subjectA === subjectA && entry.subjectB === subjectB)
      || (entry.subjectA === subjectB && entry.subjectB === subjectA))
  ));
}
