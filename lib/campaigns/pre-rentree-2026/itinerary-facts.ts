import { getPreRentreeCampaign } from './campaign-source';
import { assignItinerary } from './itinerary';
import { enumeratePedagogicalSelections } from './pedagogical-combinations';
import { getPreRentreeLevelCapacities } from './offer-options';
import type { PublicScheduleSlot } from './public-schedule';
import { ENTRY_LEVEL_IDS, type EntryLevelCode } from './schema';

/**
 * The single waiting-time figure the campaign is allowed to publish.
 *
 * Not a policy constant: the real maximum idle time a pupil can incur, read
 * off the real planning. For every pedagogically valid subject selection at
 * every level, the assignment engine picks the actual cohorts a pupil would
 * attend; this returns the largest gap between two consecutive sessions on the
 * same day across all of those itineraries that we actually propose.
 *
 * MAX_STUDENT_IDLE_MINUTES (itinerary.ts) is a different thing — the ceiling
 * above which a combination stops being proposed at all. The site used to show
 * a per-selection figure while the PDFs printed the ceiling, which is how the
 * page ended up saying 15 min and the PDFs 60 min for the same campaign.
 */
export function maxIdleMinutesAcrossPublishedItineraries(): number {
  const campaign = getPreRentreeCampaign();
  const blockById = new Map(campaign.blocks.map((block) => [block.id, block]));
  const schedule: PublicScheduleSlot[] = campaign.schedule.flatMap((window) => (
    window.days.flatMap((date) => window.slots.map((slot) => {
      const block = blockById.get(slot.block);
      if (!block) throw new Error(`Unknown schedule block: ${slot.block}`);
      return {
        date,
        level: slot.level,
        subject: slot.subject,
        block: slot.block,
        startTime: block.startTime,
        endTime: block.endTime,
        windowId: window.windowId,
        ...(slot.cohortId ? { cohortId: slot.cohortId } : {}),
        ...(slot.isPrimary !== undefined ? { isPrimary: slot.isPrimary } : {}),
      };
    }))
  ));

  const maximumSubjectsByLevel = new Map(
    getPreRentreeLevelCapacities().map((capacity) => [capacity.level, capacity.maximumSubjects]),
  );

  let maximum = 0;
  for (const level of ENTRY_LEVEL_IDS as readonly EntryLevelCode[]) {
    const subjectIds = [...new Set(
      campaign.schedule.flatMap((window) => window.slots
        .filter((slot) => slot.level === level)
        .map((slot) => slot.subject)),
    )];
    if (subjectIds.length === 0) continue;
    const maxSubjects = maximumSubjectsByLevel.get(level) ?? subjectIds.length;

    for (const selection of enumeratePedagogicalSelections(level, subjectIds, maxSubjects)) {
      const { itinerary } = assignItinerary(level, selection, schedule);
      // Only combinations the site actually proposes count: a selection we
      // refuse to sell must not inflate the published waiting time.
      if (itinerary.status !== 'COMPACT' && itinerary.status !== 'NO_SHARED_DAY') continue;
      maximum = Math.max(maximum, itinerary.maxIdleMinutes);
    }
  }
  return maximum;
}
