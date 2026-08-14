#!/usr/bin/env -S npx tsx --conditions=react-server
/**
 * Structural + pedagogical validator for the Pré-rentrée 2026 stage planning.
 *
 * Enforces, against the live campaign data (never a copy):
 *   R1. A teacher role never covers two groups in the same (window, block).
 *   R2. At most 3 concurrent groups in the same (window, block) — rooms are
 *       banalized/interchangeable, so the only room constraint is a headcount
 *       against the 3 physical rooms, never a named-room compatibility check.
 *   R3. INFORMATIVE ONLY: teacher daily load (blocks/hours per window) is
 *       computed and reported, never blocking. Hourly caps are not a rule a
 *       config file gets to enforce on a real person.
 *   R4. For every level, every PEDAGOGICALLY VALID subject combination (see
 *       pedagogical-combinations.ts — not the raw powerset) resolves to a
 *       real itinerary without the engine giving up (REQUIRES_MANUAL_REVIEW),
 *       and every itinerary the engine calls "actionable" genuinely respects
 *       the 60-minute idle cap (contract check on itinerary.ts itself).
 *   R5. Mathématiques expertes is never offered without Mathématiques.
 *   Volume: every module has exactly 5 sessions of exactly 2 hours; the
 *   canonical 14/70/20/100 taxonomy (public-schedule.ts) matches the live data.
 *
 * Exits non-zero on any violation. Run directly (`tsx --conditions=react-server
 * scripts/validate-stage-planning.ts`) or via `npm run pre-rentree:validate-planning`.
 */
import { getPreRentreeCampaign, getPreRentreeSchedule, getPreRentreeModules } from '../lib/campaigns/pre-rentree-2026/getters';
import { assignItinerary, type ItineraryStatus } from '../lib/campaigns/pre-rentree-2026/itinerary';
import {
  enumeratePedagogicalSelections,
  requiresMathematiquesForExpertes,
} from '../lib/campaigns/pre-rentree-2026/pedagogical-combinations';
import { MAX_SUBJECTS_PER_PACK } from '../lib/campaigns/pre-rentree-2026/configurator';
import { PRE_RENTREE_PUBLIC_METRICS } from '../lib/campaigns/pre-rentree-2026/public-schedule';
import type { EntryLevelCode } from '../lib/campaigns/pre-rentree-2026/schema';

export interface CombinationOutcome {
  level: EntryLevelCode;
  subjects: readonly string[];
  status: ItineraryStatus;
  maxIdleMinutes: number;
}

export interface PlanningValidationResult {
  violations: string[];
  summary: {
    modulesCount: number;
    sessionTemplatesCount: number;
    scheduledOccurrencesCount: number;
    combinationsByLevel: Record<string, CombinationOutcome[]>;
    teacherDailyBlocks: Record<string, Record<string, number>>;
  };
}

const ACTIONABLE_STATUSES = new Set<ItineraryStatus>(['COMPACT', 'NO_SHARED_DAY']);

export function runStagePlanningValidation(): PlanningValidationResult {
  const violations: string[] = [];
  const campaign = getPreRentreeCampaign();
  const modules = getPreRentreeModules();
  const datedSchedule = getPreRentreeSchedule();

  // --- Module/volume invariants ------------------------------------------
  for (const campaignModule of modules) {
    if (campaignModule.sessions.length !== 5) {
      violations.push(
        `Module ${campaignModule.id} has ${campaignModule.sessions.length} sessions, expected exactly 5.`,
      );
    }
  }
  const sessionTemplatesCount = modules.reduce((sum, m) => sum + m.sessions.length, 0);
  if (sessionTemplatesCount !== PRE_RENTREE_PUBLIC_METRICS.preparedSessionCount) {
    violations.push(
      `Session template count drifted: computed ${sessionTemplatesCount}, `
      + `PRE_RENTREE_PUBLIC_METRICS declares ${PRE_RENTREE_PUBLIC_METRICS.preparedSessionCount}.`,
    );
  }
  if (modules.length !== PRE_RENTREE_PUBLIC_METRICS.pedagogicalModuleCount) {
    violations.push(
      `Module count drifted: computed ${modules.length}, `
      + `PRE_RENTREE_PUBLIC_METRICS declares ${PRE_RENTREE_PUBLIC_METRICS.pedagogicalModuleCount}.`,
    );
  }
  if (datedSchedule.length !== PRE_RENTREE_PUBLIC_METRICS.scheduledSessionOccurrenceCount) {
    violations.push(
      `Scheduled occurrence count drifted: computed ${datedSchedule.length}, `
      + `PRE_RENTREE_PUBLIC_METRICS declares ${PRE_RENTREE_PUBLIC_METRICS.scheduledSessionOccurrenceCount}.`,
    );
  }
  // Volume = 10h x subjects: every (level, subject) cohort must resolve to
  // exactly 5 dated occurrences (never merged with an alternative cohort's
  // sessions, never short).
  const occurrencesByCohort = new Map<string, number>();
  for (const session of datedSchedule) {
    const key = `${session.level}/${session.subject}/${session.cohortId ?? 'primary'}`;
    occurrencesByCohort.set(key, (occurrencesByCohort.get(key) ?? 0) + 1);
  }
  for (const [key, count] of occurrencesByCohort) {
    if (count !== PRE_RENTREE_PUBLIC_METRICS.studentSessionsPerSubject) {
      violations.push(`Cohort ${key} has ${count} scheduled occurrences, expected exactly 5 (10h).`);
    }
  }

  // --- R1/R2: resource contention, R3: informative load report, per window
  // (a window's slots repeat identically on every calendar day it spans, so
  // checking once per window covers every day) --------------------------
  const teacherDailyBlocks: Record<string, Record<string, number>> = {};
  for (const window of campaign.schedule) {
    const byBlockTeacher = new Map<string, string[]>();
    const groupCountByBlock = new Map<string, number>();
    const teacherBlockCounts = new Map<string, number>();

    for (const slot of window.slots) {
      const teacherKey = `${window.windowId}/${slot.block}`;
      byBlockTeacher.set(teacherKey, [...(byBlockTeacher.get(teacherKey) ?? []), slot.teacherRole]);
      groupCountByBlock.set(teacherKey, (groupCountByBlock.get(teacherKey) ?? 0) + 1);
      teacherBlockCounts.set(slot.teacherRole, (teacherBlockCounts.get(slot.teacherRole) ?? 0) + 1);
    }

    for (const [key, teachers] of byBlockTeacher) {
      if (new Set(teachers).size !== teachers.length) {
        violations.push(`R1 violated: teacher role double-booked at ${key} (${teachers.join(', ')}).`);
      }
    }
    for (const [key, groupCount] of groupCountByBlock) {
      if (groupCount > campaign.rooms.length) {
        violations.push(
          `R2 violated: ${groupCount} concurrent groups at ${key}, `
          + `only ${campaign.rooms.length} rooms available.`,
        );
      }
    }
    for (const [teacherRole, blockCount] of teacherBlockCounts) {
      const role = campaign.teacherRoles[teacherRole];
      if (!role) {
        violations.push(`Schedule references unknown teacher role ${teacherRole} in ${window.windowId}.`);
        continue;
      }
      // R3 is informative only: the load is computed and reported below
      // (teacherDailyBlocks), never turned into a violation.
      teacherDailyBlocks[teacherRole] ??= {};
      teacherDailyBlocks[teacherRole]![window.windowId] = blockCount;
    }
  }

  // --- R4/R5: pedagogically valid combinations only --------------------
  const levels: EntryLevelCode[] = campaign.levels.map((level) => level.id);
  const combinationsByLevel: Record<string, CombinationOutcome[]> = {};

  for (const level of levels) {
    const availableSubjectIds = campaign.subjects
      .filter((subject) => subject.levels.includes(level))
      .map((subject) => subject.id);
    const combinations = enumeratePedagogicalSelections(level, availableSubjectIds, MAX_SUBJECTS_PER_PACK);
    combinationsByLevel[level] = [];

    for (const subjects of combinations) {
      if (!requiresMathematiquesForExpertes(subjects)) {
        violations.push(`R5 violated: enumerated an invalid combination ${level}/${subjects.join('+')} (Maths expertes without Mathématiques).`);
        continue;
      }
      const assignment = assignItinerary(level, subjects, datedSchedule);
      const { status, maxIdleMinutes } = assignment.itinerary;
      combinationsByLevel[level]!.push({ level, subjects, status, maxIdleMinutes });

      if (status === 'REQUIRES_MANUAL_REVIEW') {
        violations.push(`R4 violated: ${level}/${subjects.join('+')} could not be resolved by the itinerary engine (REQUIRES_MANUAL_REVIEW).`);
      }
      if (ACTIONABLE_STATUSES.has(status) && maxIdleMinutes > 60) {
        violations.push(`R4 contract violated: ${level}/${subjects.join('+')} is reported ${status} but has ${maxIdleMinutes}min idle (> 60min cap).`);
      }
    }
  }

  return {
    violations,
    summary: {
      modulesCount: modules.length,
      sessionTemplatesCount,
      scheduledOccurrencesCount: datedSchedule.length,
      combinationsByLevel,
      teacherDailyBlocks,
    },
  };
}

function main() {
  const result = runStagePlanningValidation();
  const totalCombinations = Object.values(result.summary.combinationsByLevel).reduce((sum, list) => sum + list.length, 0);
  const actionable = Object.values(result.summary.combinationsByLevel)
    .flat()
    .filter((c) => ACTIONABLE_STATUSES.has(c.status)).length;

  process.stdout.write(`${JSON.stringify({
    modulesCount: result.summary.modulesCount,
    sessionTemplatesCount: result.summary.sessionTemplatesCount,
    scheduledOccurrencesCount: result.summary.scheduledOccurrencesCount,
    combinationsTested: totalCombinations,
    actionableCombinations: actionable,
    blockedCombinations: totalCombinations - actionable,
    violationCount: result.violations.length,
  }, null, 2)}\n`);

  if (result.violations.length > 0) {
    process.stderr.write(`\nVIOLATIONS:\n${result.violations.map((v) => `  - ${v}`).join('\n')}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
