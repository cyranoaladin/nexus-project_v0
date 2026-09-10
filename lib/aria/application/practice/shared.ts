import { AriaError } from '../../errors';
import type { ActivityRecord, ActivityRepository } from './ports';

/** An Activity with no ACTIVE version is treated the same as not found — nothing to attempt or submit against. */
export async function getActivityById(
  repository: ActivityRepository,
  activityId: string,
): Promise<ActivityRecord & { readonly activeVersion: NonNullable<ActivityRecord['activeVersion']> }> {
  const activity = await repository.getActivityById(activityId);
  if (!activity || !activity.activeVersion) {
    throw new AriaError('BAD_REQUEST', 404, 'Activité ARIA introuvable.');
  }
  return activity as ActivityRecord & { readonly activeVersion: NonNullable<ActivityRecord['activeVersion']> };
}
