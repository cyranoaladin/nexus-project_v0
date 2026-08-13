export function isStageExpired(endDate: Date, now: Date) {
  return endDate.getTime() < now.getTime();
}

export function getActiveStageEndDateFilter(now: Date) {
  return { gte: now };
}
