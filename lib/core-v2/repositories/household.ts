/**
 * Household is the family membership authority (ADR item 2). Creating a
 * household with its first parent is one atomic unit — a household should
 * never exist, even transiently, with zero parents attached.
 */
import type { Household, HouseholdParent, Prisma, PrismaClient } from '@/core-v2/generated/client';

export interface CreateHouseholdWithParentInput {
  readonly parentUserId: string;
  readonly isPrimaryContact?: boolean;
}

export async function createHouseholdWithParent(
  client: PrismaClient,
  input: CreateHouseholdWithParentInput,
): Promise<{ household: Household; parent: HouseholdParent }> {
  return client.$transaction(async (tx) => {
    const household = await tx.household.create({ data: {} });
    const parent = await tx.householdParent.create({
      data: {
        householdId: household.id,
        userId: input.parentUserId,
        isPrimaryContact: input.isPrimaryContact ?? true,
      },
    });
    return { household, parent };
  });
}

export async function addParentToHousehold(
  client: Pick<PrismaClient, 'householdParent'>,
  householdId: string,
  parentUserId: string,
  options?: { isPrimaryContact?: boolean },
): Promise<HouseholdParent> {
  return client.householdParent.create({
    data: {
      householdId,
      userId: parentUserId,
      isPrimaryContact: options?.isPrimaryContact ?? false,
    },
  });
}

export async function listHouseholdParents(
  client: Pick<PrismaClient, 'householdParent'>,
  householdId: string,
): Promise<HouseholdParent[]> {
  return client.householdParent.findMany({ where: { householdId } });
}

export type HouseholdWithMembers = Prisma.HouseholdGetPayload<{
  include: { parents: true; students: true };
}>;

export async function getHouseholdWithMembers(
  client: Pick<PrismaClient, 'household'>,
  householdId: string,
): Promise<HouseholdWithMembers | null> {
  return client.household.findUnique({
    where: { id: householdId },
    include: { parents: true, students: true },
  });
}
