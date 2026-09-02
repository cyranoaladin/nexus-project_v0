import type { PrismaClient } from '@prisma/client';
import { setStudentChosenCourses } from '../../lib/curriculum/enrollment';

export type AriaE2EPersonaKey =
  | 'ariaTerminaleMaths'
  | 'ariaPremiereMaths'
  | 'ariaNsi'
  | 'ariaNsiPeer'
  | 'ariaStmgNoChat'
  | 'ariaIncompleteProfile'
  | 'ariaNotEntitled';

interface AriaE2EPersonaDefinition {
  readonly key: AriaE2EPersonaKey;
  readonly email: string;
  readonly firstName: string;
  readonly gradeLevel: 'PREMIERE' | 'TERMINALE' | 'AUTRE';
  readonly academicTrack: 'EDS_GENERALE' | 'STMG';
  readonly stmgPathway: 'SIG' | null;
  readonly chosenCourseKeys: readonly string[];
  readonly entitlementCourseKeys: readonly string[];
}

export const ARIA_E2E_PERSONAS = Object.freeze([
  {
    key: 'ariaTerminaleMaths',
    email: 'aria-terminale-maths@example.test',
    firstName: 'Amina',
    gradeLevel: 'TERMINALE',
    academicTrack: 'EDS_GENERALE',
    stmgPathway: null,
    chosenCourseKeys: ['eds-maths-terminale', 'eds-nsi-terminale'],
    entitlementCourseKeys: ['eds-maths-terminale', 'eds-nsi-terminale'],
  },
  {
    key: 'ariaPremiereMaths',
    email: 'aria-premiere-maths@example.test',
    firstName: 'Mehdi',
    gradeLevel: 'PREMIERE',
    academicTrack: 'EDS_GENERALE',
    stmgPathway: null,
    chosenCourseKeys: ['eds-maths-premiere'],
    entitlementCourseKeys: ['eds-maths-premiere'],
  },
  {
    key: 'ariaNsi',
    email: 'aria-nsi@example.test',
    firstName: 'Nour',
    gradeLevel: 'PREMIERE',
    academicTrack: 'EDS_GENERALE',
    stmgPathway: null,
    chosenCourseKeys: ['eds-nsi-premiere'],
    entitlementCourseKeys: ['eds-nsi-premiere'],
  },
  {
    key: 'ariaNsiPeer',
    email: 'aria-nsi-peer@example.test',
    firstName: 'Lina',
    gradeLevel: 'PREMIERE',
    academicTrack: 'EDS_GENERALE',
    stmgPathway: null,
    chosenCourseKeys: ['eds-nsi-premiere'],
    entitlementCourseKeys: ['eds-nsi-premiere'],
  },
  {
    key: 'ariaStmgNoChat',
    email: 'aria-stmg-no-chat@example.test',
    firstName: 'Youssef',
    gradeLevel: 'PREMIERE',
    academicTrack: 'STMG',
    stmgPathway: 'SIG',
    chosenCourseKeys: [],
    entitlementCourseKeys: ['stmg-sgn-premiere'],
  },
  {
    key: 'ariaIncompleteProfile',
    email: 'aria-incomplete-profile@example.test',
    firstName: 'Ines',
    gradeLevel: 'AUTRE',
    academicTrack: 'EDS_GENERALE',
    stmgPathway: null,
    chosenCourseKeys: [],
    entitlementCourseKeys: [],
  },
  {
    key: 'ariaNotEntitled',
    email: 'aria-not-entitled@example.test',
    firstName: 'Sami',
    gradeLevel: 'PREMIERE',
    academicTrack: 'EDS_GENERALE',
    stmgPathway: null,
    chosenCourseKeys: ['eds-nsi-premiere'],
    entitlementCourseKeys: [],
  },
] satisfies readonly AriaE2EPersonaDefinition[]);

export async function createAriaE2EPersonas(input: {
  readonly prisma: PrismaClient;
  readonly passwordHash: string;
  readonly runtimePassword: string;
  readonly parentProfileId: string;
  readonly environment?: Readonly<Record<string, string | undefined>>;
}): Promise<Record<AriaE2EPersonaKey, { readonly email: string; readonly password: string }>> {
  if ((input.environment ?? process.env).E2E_DISPOSABLE_STACK !== '1') {
    throw new Error('ARIA_E2E_PERSONA_SEED_FORBIDDEN');
  }
  const credentials = {} as Record<
    AriaE2EPersonaKey,
    { readonly email: string; readonly password: string }
  >;
  for (const definition of ARIA_E2E_PERSONAS) {
    const user = await input.prisma.user.create({
      data: {
        email: definition.email,
        password: input.passwordHash,
        role: 'ELEVE',
        firstName: definition.firstName,
        lastName: 'ARIA E2E',
        activatedAt: new Date('2026-08-30T12:00:00.000Z'),
      },
    });
    const student = await input.prisma.student.create({
      data: {
        userId: user.id,
        parentId: input.parentProfileId,
        grade: definition.gradeLevel,
        gradeLevel: definition.gradeLevel,
        academicTrack: definition.academicTrack,
        stmgPathway: definition.stmgPathway,
        credits: 0,
      },
    });
    await setStudentChosenCourses(
      student.id,
      {
        gradeLevel: definition.gradeLevel,
        academicTrack: definition.academicTrack,
        stmgPathway: definition.stmgPathway,
      },
      definition.chosenCourseKeys,
      { source: 'SEED' },
      input.prisma,
    );
    if (definition.entitlementCourseKeys.length > 0) {
      await input.prisma.entitlement.create({
        data: {
          userId: user.id,
          productCode: 'ARIA_ACCESS',
          label: `ARIA E2E — ${definition.key}`,
          status: 'ACTIVE',
          startsAt: new Date('2026-08-01T00:00:00.000Z'),
          endsAt: new Date('2027-07-01T00:00:00.000Z'),
          ariaScopes: {
            create: definition.entitlementCourseKeys.map((courseKey) => ({
              kind: 'COURSE' as const,
              courseKey,
            })),
          },
        },
      });
    }
    credentials[definition.key] = Object.freeze({
      email: definition.email,
      password: input.runtimePassword,
    });
  }
  return Object.freeze(credentials);
}
