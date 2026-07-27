import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  buildStageAvailabilityMessage,
} from '../../lib/campaigns/pre-rentree-2026/availability-message';
import {
  assignItinerary,
  enumerateSelections,
} from '../../lib/campaigns/pre-rentree-2026/itinerary';
import {
  getPreRentreeCampaign,
  getPreRentreeSchedule,
  getPreRentreeOfferOptions,
} from '../../lib/campaigns/pre-rentree-2026/getters';
import type {
  EntryLevelCode,
} from '../../lib/campaigns/pre-rentree-2026/schema';

const outputArgumentIndex = process.argv.indexOf('--output');
const output = resolve(
  outputArgumentIndex >= 0
    ? process.argv[outputArgumentIndex + 1]!
    : 'assets/campaigns/pre-rentree-2026/schedule-optimization/selection-matrix-final.json',
);
const campaign = getPreRentreeCampaign();
const dto = {
  campaign,
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

const rows = levels.flatMap((level) => {
  const subjectIds = dto.subjects
    .filter((subject) => subject.levels.includes(level))
    .map((subject) => subject.id);
  return enumerateSelections(subjectIds, 4).map((selectedSubjectIds) => {
    const assignment = assignItinerary(level, selectedSubjectIds, dto.schedule);
    const pack = dto.offerOptions.find(
      (candidate) =>
        candidate.level === level &&
        candidate.subjectsCount === selectedSubjectIds.length,
    );
    if (!pack) {
      throw new Error(
        `Missing canonical pack for ${level}/${selectedSubjectIds.length}`,
      );
    }
    const availabilityMessage = buildStageAvailabilityMessage({
      level,
      levels: dto.levels,
      subjects: dto.subjects,
      selectedSubjectIds,
      assignment,
      totalHours: pack.totalHours,
    });
    const dates = [
      ...new Set(
        Object.values(assignment.sessionsBySubject)
          .flat()
          .map((session) => session.date),
      ),
    ].sort();
    const actionable = actionableStatuses.has(assignment.itinerary.status);

    return {
      level,
      subjects: selectedSubjectIds,
      subjectCount: selectedSubjectIds.length,
      status: assignment.itinerary.status,
      actionable,
      explanation: actionable
        ? 'Itinéraire structurel proposé, sous réserve de disponibilité.'
        : assignment.itinerary.status === 'LONG_IDLE'
          ? `Attente maximale de ${assignment.itinerary.maxIdleMinutes} minutes.`
          : 'Conflit horaire : parcours non actionnable.',
      maxIdleMinutes: assignment.itinerary.maxIdleMinutes,
      dates,
      cohortBySubject: assignment.cohortBySubject,
      sessionCountBySubject: Object.fromEntries(
        selectedSubjectIds.map((subject) => [
          subject,
          assignment.sessionsBySubject[subject]!.length,
        ]),
      ),
      studentHoursPerSubject: 10,
      availabilityMessageSha256: createHash('sha256')
        .update(availabilityMessage)
        .digest('hex'),
      whatsappNumber: '21699192829',
    };
  });
});

const statusCounts = Object.fromEntries(
  [...new Set(rows.map((row) => row.status))]
    .sort()
    .map((status) => [
      status,
      rows.filter((row) => row.status === status).length,
    ]),
);
const payload = {
  schemaVersion: '1.0.0',
  source: {
    campaignVersion: dto.campaign.version,
    timezone: dto.campaign.timezone,
    startDate: dto.campaign.startDate,
    endDate: dto.campaign.endDate,
    maxSubjects: 4,
    studentSessionsPerSubject: 5,
    studentHoursPerSubject: 10,
  },
  summary: {
    combinationCount: rows.length,
    actionableCount: rows.filter((row) => row.actionable).length,
    blockedCount: rows.filter((row) => !row.actionable).length,
    statusCounts,
    maximumActionableIdleMinutes: Math.max(
      ...rows.filter((row) => row.actionable).map((row) => row.maxIdleMinutes),
    ),
  },
  rows,
};

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`);
process.stdout.write(
  `${JSON.stringify({ output, ...payload.summary }, null, 2)}\n`,
);
