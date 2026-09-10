/**
 * User identity is NOT redesigned by Core v2 (see core-v2/prisma/schema.prisma
 * header) — this repository is a thin helper, not a source-of-truth change.
 */
import type { PrismaClient, User, UserRole } from '@/core-v2/generated/client';

export interface CreateUserInput {
  readonly role: UserRole;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
}

export async function createUser(
  client: Pick<PrismaClient, 'user'>,
  input: CreateUserInput,
): Promise<User> {
  return client.user.create({ data: input });
}
