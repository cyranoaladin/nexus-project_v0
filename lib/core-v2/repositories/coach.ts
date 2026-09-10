import type { CoachProfile, PrismaClient } from '@/core-v2/generated/client';

export interface CreateCoachProfileInput {
  readonly userId: string;
}

export async function createCoachProfile(
  client: Pick<PrismaClient, 'coachProfile'>,
  input: CreateCoachProfileInput,
): Promise<CoachProfile> {
  return client.coachProfile.create({ data: input });
}
