/**
 * Replaces CoachProfile.subjects (Json) as the authorization source (ADR
 * item 3). Never read CoachProfile.subjects here — that field does not even
 * exist on this model (see core-v2/prisma/schema.prisma's CoachProfile).
 */
import type { CoachCourseCapability, PrismaClient } from '@/core-v2/generated/client';

export interface GrantCapabilityInput {
  readonly coachId: string;
  readonly courseKey: string;
}

export async function grantCapability(
  client: Pick<PrismaClient, 'coachCourseCapability'>,
  input: GrantCapabilityInput,
): Promise<CoachCourseCapability> {
  return client.coachCourseCapability.create({ data: input });
}

export async function hasCapability(
  client: Pick<PrismaClient, 'coachCourseCapability'>,
  coachId: string,
  courseKey: string,
): Promise<boolean> {
  const found = await client.coachCourseCapability.findUnique({
    where: { coachId_courseKey: { coachId, courseKey } },
  });
  return found !== null;
}
