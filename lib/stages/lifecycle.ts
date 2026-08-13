export const EXPIRED_STAGE_ERROR = 'Un stage terminé ne peut pas être ouvert aux inscriptions';

export function isStageExpired(endDate: Date, now: Date) {
  return endDate.getTime() < now.getTime();
}

export function getActiveStageEndDateFilter(now: Date) {
  return { gte: now };
}
