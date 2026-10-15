import { readRuntimeCredentialsManifest } from '../lib/security/seed-runtime';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { assertCoreV1E2eSeedTarget } from './e2e/v1-seed-target';
import { ARIA_E2E_PERSONAS } from './e2e/aria-personas';
import { CORE_V2_ARIA_FOUNDATION_EMAIL } from './e2e/aria-foundation-identity';

type Credential = { email?: unknown; password?: unknown };

const expectedRoles = {
  admin: UserRole.ADMIN,
  parent: UserRole.PARENT,
  student: UserRole.ELEVE,
  student2: UserRole.ELEVE,
  studentSurvival: UserRole.ELEVE,
  coach: UserRole.COACH,
  coachV1: UserRole.COACH,
  coach2: UserRole.COACH,
  assistante: UserRole.ASSISTANTE,
  zenon: UserRole.COACH,
  ariaTerminaleMaths: UserRole.ELEVE,
  ariaPremiereMaths: UserRole.ELEVE,
  ariaNsi: UserRole.ELEVE,
  ariaNsiPeer: UserRole.ELEVE,
  ariaStmgNoChat: UserRole.ELEVE,
  ariaIncompleteProfile: UserRole.ELEVE,
  ariaNotEntitled: UserRole.ELEVE,
  coreV2AriaFoundation: UserRole.ELEVE,
  ariaPersonasParent: UserRole.PARENT,
} as const;

/** Read-only validation of every credential identity and its authoritative fixture relations. */
export async function verifyE2eSeed(prisma: PrismaClient, credentials: Record<string, Credential>) {
  const refuse = () => { throw new Error('E2E_SEED_VERIFICATION_FAILED'); };
  if (Object.keys(credentials).sort().join('\0') !== Object.keys(expectedRoles).sort().join('\0')
    || await prisma.user.count() === 0) refuse();
  const select = { id: true, email: true, role: true, password: true, activatedAt: true, disabledAt: true, mergedIntoUserId: true,
    parentProfile: { select: { id: true, userId: true } }, student: { select: { id: true, userId: true, parentId: true } } } as const;
  type Identity = NonNullable<Awaited<ReturnType<typeof lookup>>>;
  const lookup = (email: string) => prisma.user.findUnique({ where: { email }, select });
  const identities = new Map<string, Identity>();
  const ids = new Set<string>();
  for (const [fixtureName, expectedRole] of Object.entries(expectedRoles)) {
    const credential = credentials[fixtureName];
    if (typeof credential?.email !== 'string' || typeof credential.password !== 'string' || credential.password.length < 32) refuse();
    const user = await lookup(credential.email as string);
    if (!user || user.role !== expectedRole || !user.activatedAt || user.disabledAt || user.mergedIntoUserId
      || !user.password || !await bcrypt.compare(credential.password as string, user.password) || ids.has(user.id)) refuse();
    identities.set(fixtureName, user!); ids.add(user!.id);
  }
  const ariaParent = identities.get('ariaPersonasParent')!;
  if (!ariaParent.parentProfile || ariaParent.parentProfile.userId !== ariaParent.id
    || ariaParent.id === identities.get('parent')!.id) refuse();
  const students = new Set<string>();
  for (const persona of ARIA_E2E_PERSONAS) {
    const user = identities.get(persona.key)!;
    if (user.email !== persona.email || !user.student || user.student.userId !== user.id
      || user.student.parentId !== ariaParent.parentProfile!.id || students.has(user.student.id)) refuse();
    students.add(user.student!.id);
  }
  const foundation = identities.get('coreV2AriaFoundation')!;
  if (foundation.email !== CORE_V2_ARIA_FOUNDATION_EMAIL || foundation.student || foundation.parentProfile) refuse();
  return { identities: identities.size, ariaPersonas: students.size };
}

async function main() {
  assertCoreV1E2eSeedTarget(process.env);
  const credentials = readRuntimeCredentialsManifest(process.env.E2E_CREDENTIALS_PATH ?? 'e2e/.credentials.json') as Record<string, Credential>;
  const prisma = new PrismaClient();
  try { console.info(JSON.stringify(await verifyE2eSeed(prisma, credentials))); }
  finally { await prisma.$disconnect(); }
}
if (require.main === module) main().catch(() => { console.error('E2E_SEED_VERIFICATION_FAILED'); process.exitCode = 1; });
