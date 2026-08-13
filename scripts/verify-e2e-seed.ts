import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { serializeError } from '../lib/utils/serialize-error';
import { isAllowedSeedTarget } from '../lib/e2e/seed-guard';

type Credential = { email?: unknown; password?: unknown };

const expectedRoles = {
  admin: UserRole.ADMIN,
  parent: UserRole.PARENT,
  student: UserRole.ELEVE,
  student2: UserRole.ELEVE,
  studentSurvival: UserRole.ELEVE,
  coach: UserRole.COACH,
  coach2: UserRole.COACH,
  assistante: UserRole.ASSISTANTE,
  zenon: UserRole.COACH,
} as const;

async function main() {
  const target = isAllowedSeedTarget(process.env.DATABASE_URL ?? '');
  if (!target.ok) {
    throw new Error('Refusing to verify a non-ephemeral E2E database');
  }

  const credentialsPath = resolve(process.env.E2E_CREDENTIALS_PATH ?? 'e2e/.credentials.json');
  const credentials = JSON.parse(readFileSync(credentialsPath, 'utf8')) as Record<string, Credential>;
  const prisma = new PrismaClient();

  try {
    const totalUsers = await prisma.user.count();
    if (totalUsers === 0) {
      throw new Error('E2E seed verification failed: database contains zero users');
    }

    for (const [fixtureName, expectedRole] of Object.entries(expectedRoles)) {
      const credential = credentials[fixtureName];
      if (typeof credential?.email !== 'string' || typeof credential.password !== 'string') {
        throw new Error(`E2E seed verification failed: fixture ${fixtureName} is incomplete`);
      }

      const user = await prisma.user.findUnique({
        where: { email: credential.email },
        select: { role: true, password: true },
      });
      if (user?.role !== expectedRole) {
        throw new Error(`E2E seed verification failed: fixture ${fixtureName} has the wrong role`);
      }
      if (!user.password || !await bcrypt.compare(credential.password, user.password)) {
        throw new Error(`E2E seed verification failed: fixture ${fixtureName} password is out of sync`);
      }
    }

    console.log(`E2E seed verified: ${Object.keys(expectedRoles).length} identities across required roles`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('E2E seed verification failed', serializeError(error));
  process.exit(1);
});
