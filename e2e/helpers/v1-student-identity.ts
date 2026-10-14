/**
 * Core v1 credential identity for a disposable Core v2 student persona.
 *
 * Under CORE_V2_AUTH_MODE=V1_ONLY (the production contract) only Core v1
 * authenticates: Core v2 never stores a credential
 * (lib/core-v2/accounts/v1-authority.ts). A spec that signs a Core v2 student
 * in therefore creates the V1 user here (bcrypt password, activated ELEVE, no
 * V1 Student) and the Core v2 user under the SAME id with `password: null`;
 * Core v2 then resolves the V1 session's actor by that id. Same pattern as
 * scripts/core-v2/seed-e2e-staff-actors.ts and scripts/seed-e2e-db.ts.
 *
 * The client is created lazily: `playwright test --list` loads every spec's
 * module scope without any env set, so nothing here may throw on import.
 */
import bcrypt from 'bcryptjs';
import { PrismaClient as CoreV1PrismaClient } from '@prisma/client';
import { assertDisposableE2eDatabase } from './disposable-database';

let coreV1: CoreV1PrismaClient | null = null;

function getCoreV1(): CoreV1PrismaClient {
  if (!coreV1) {
    const url = process.env.DATABASE_URL ?? '';
    assertDisposableE2eDatabase(url);
    coreV1 = new CoreV1PrismaClient({ datasources: { db: { url } } });
  }
  return coreV1;
}

export type V1StudentIdentity = {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

export async function createV1StudentIdentity(identity: V1StudentIdentity): Promise<void> {
  await getCoreV1().user.create({
    data: {
      id: identity.id,
      email: identity.email,
      password: await bcrypt.hash(identity.password, 4),
      role: 'ELEVE',
      firstName: identity.firstName,
      lastName: identity.lastName,
      activatedAt: new Date(),
    },
  });
}

export async function deleteV1StudentIdentity(id: string): Promise<void> {
  await getCoreV1().user.deleteMany({ where: { id, role: 'ELEVE' } });
}

export async function disconnectV1StudentIdentityClient(): Promise<void> {
  await coreV1?.$disconnect();
  coreV1 = null;
}
