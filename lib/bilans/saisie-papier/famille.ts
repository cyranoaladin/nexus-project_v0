import { createId } from '@paralleldrive/cuid2';
import type { GradeLevel, Prisma, PrismaClient } from '@prisma/client';
import type { Session } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/auth';
import { createActivationToken } from '@/lib/auth/activation-token';
import {
  buildAccountActivationEmail,
  buildParentActivationEmail,
  createParentActivationToken,
  normalizeParentEmail,
} from '@/lib/auth/parent-activation';
import { createParentStudentConsentContext } from '@/lib/bilans/parent-student-consent';
import { enqueueEmailIntent } from '@/lib/email/outbox';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';
import { prisma } from '@/lib/prisma';
import { buildStudentLoginIdentifier } from '@/lib/services/student-login-identifier';
import { normalizeStudentLevelAndTrack } from '@/lib/utils/grade-utils';

import { CanonicalApiError } from '../api/errors';
import { canonicalErrorResponse } from '../api/http';
import {
  executeIdempotently,
  parseIdempotencyKey,
  type CanonicalTransaction,
  type IdempotencyDatabase,
} from '../api/idempotency';
import { assertStaffActor } from './access';

/**
 * Création du foyer, côté staff, préalable à une saisie papier.
 *
 * Le parent est créé en **activation en attente** : `password: null`, un jeton
 * d'activation lui est envoyé, et il posera lui-même son mot de passe.
 * Personne — pas même l'assistante qui saisit — ne fixe un mot de passe à sa
 * place. C'est exactement le comportement du parcours public
 * (`POST /api/bilan-gratuit`), dont ce module réutilise la machinerie ; seule
 * l'authentification change, du public au staff.
 *
 * L'enfant n'a besoin que d'un prénom et d'un niveau : son identifiant de
 * connexion est dérivé, comme ailleurs, et son compte reste inactif.
 */

const FAMILY_ROUTE = 'POST:/api/bilans/saisie-papier/famille';

const childSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  // Le nom n'est pas demandé sur une copie : à défaut, celui du parent.
  lastName: z.string().trim().min(1).max(80).optional(),
  grade: z.string().trim().min(1).max(80),
}).strict();

const requestSchema = z.object({
  parentEmail: z.string().trim().email().max(160),
  parentFirstName: z.string().trim().min(1).max(80),
  parentLastName: z.string().trim().min(1).max(80),
  children: z.array(childSchema).min(1).max(6),
}).strict();

type FamilyDatabase = IdempotencyDatabase & Readonly<Record<string, unknown>>;

export type PaperEntryFamilyDependencies = Readonly<{
  prisma: PrismaClient | FamilyDatabase;
  authenticate: () => Promise<Session | null>;
  now: () => Date;
}>;

const defaultDependencies: PaperEntryFamilyDependencies = {
  prisma,
  authenticate: auth,
  now: () => new Date(),
};

type ResolvedChild = Readonly<{
  firstName: string;
  lastName: string;
  grade: string;
  level: GradeLevel;
  track: NonNullable<ReturnType<typeof normalizeStudentLevelAndTrack>>['track'];
}>;

type CreatedChild = Readonly<{ studentId: string; firstName: string; gradeLevel: GradeLevel }>;

type FamilyResult = Readonly<{
  parentUserId: string;
  parentCreated: boolean;
  children: readonly CreatedChild[];
}>;

function resolveChildren(input: z.infer<typeof requestSchema>): readonly ResolvedChild[] {
  return input.children.map((child) => {
    const gTrack = normalizeStudentLevelAndTrack(child.grade);
    if (gTrack === null) throw CanonicalApiError.badRequest('STUDENT_GRADE_UNKNOWN');
    return {
      firstName: child.firstName,
      lastName: child.lastName ?? input.parentLastName,
      grade: child.grade,
      level: gTrack.level,
      track: gTrack.track,
    };
  });
}

async function requestBody(request: NextRequest): Promise<z.infer<typeof requestSchema>> {
  try {
    return requestSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof CanonicalApiError) throw error;
    throw CanonicalApiError.badRequest();
  }
}

type PreparePending = ReturnType<typeof createParentStudentConsentContext>['preparePending'];

async function createChildren(
  transaction: Prisma.TransactionClient,
  preparePending: PreparePending,
  input: Readonly<{
    parentUserId: string;
    parentProfileId: string;
    parentEmail: string;
    children: readonly ResolvedChild[];
    now: Date;
  }>,
): Promise<readonly CreatedChild[]> {
  const created: CreatedChild[] = [];
  for (const child of input.children) {
    const activation = createActivationToken('student');
    const user = await transaction.user.create({
      data: {
        email: buildStudentLoginIdentifier({
          firstName: child.firstName,
          lastName: child.lastName,
          uniqueSuffix: createId().slice(0, 4),
        }),
        role: 'ELEVE',
        firstName: child.firstName,
        lastName: child.lastName,
        password: null,
        activatedAt: null,
        activationToken: activation.tokenHash,
        activationExpiry: activation.expiresAt,
      },
    });
    const student = await transaction.student.create({
      data: {
        userId: user.id,
        parentId: input.parentProfileId,
        grade: child.grade,
        gradeLevel: child.level,
        academicTrack: child.track,
      },
      select: { id: true },
    });
    await preparePending({
      parentUserId: input.parentUserId,
      studentId: student.id,
      now: input.now,
    });

    const message = buildAccountActivationEmail({
      displayName: `${child.firstName} ${child.lastName}`,
      rawToken: activation.rawToken,
      accountRole: 'ELEVE',
    });
    await enqueueEmailIntent(transaction, {
      aggregateId: user.id,
      messageType: 'STUDENT_ACTIVATION',
      dedupeKey: activation.tokenHash,
      to: input.parentEmail,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });

    created.push({ studentId: student.id, firstName: child.firstName, gradeLevel: child.level });
  }
  return created;
}

async function createFamily(
  transaction: Prisma.TransactionClient,
  context: Readonly<{
    input: z.infer<typeof requestSchema>;
    children: readonly ResolvedChild[];
    parentEmail: string;
    now: Date;
  }>,
): Promise<FamilyResult> {
  const { input, children, parentEmail, now } = context;
  const { preparePending } = createParentStudentConsentContext(transaction);

  const existing = await transaction.user.findUnique({
    where: { email: parentEmail },
    select: { id: true, role: true, parentProfile: { select: { id: true } } },
  });

  // Parent déjà connu : on lui rattache les enfants sans toucher à son compte.
  // Ni son mot de passe, ni son état d'activation ne sont réécrits — un parent
  // déjà activé le reste, un parent en attente le reste aussi.
  if (existing !== null) {
    if (existing.role !== 'PARENT') throw CanonicalApiError.conflict('PARENT_EMAIL_ROLE_CONFLICT');
    const profileId = existing.parentProfile?.id
      ?? (await transaction.parentProfile.create({ data: { userId: existing.id } })).id;
    return {
      parentUserId: existing.id,
      parentCreated: false,
      children: await createChildren(transaction, preparePending, {
        parentUserId: existing.id,
        parentProfileId: profileId,
        parentEmail,
        children,
        now,
      }),
    };
  }

  const activation = createParentActivationToken(now);
  const parentUser = await transaction.user.create({
    data: {
      email: parentEmail,
      role: 'PARENT',
      firstName: input.parentFirstName,
      lastName: input.parentLastName,
      // Activation en attente : le parent posera son mot de passe.
      password: null,
      activatedAt: null,
      activationToken: activation.tokenHash,
      activationExpiry: activation.expiresAt,
    },
  });
  const profile = await transaction.parentProfile.create({ data: { userId: parentUser.id } });
  const createdChildren = await createChildren(transaction, preparePending, {
    parentUserId: parentUser.id,
    parentProfileId: profile.id,
    parentEmail,
    children,
    now,
  });

  const message = buildParentActivationEmail({
    parentName: `${input.parentFirstName} ${input.parentLastName}`,
    childFirstName: createdChildren[0]?.firstName ?? 'votre enfant',
    rawToken: activation.rawToken,
  });
  await enqueueEmailIntent(transaction, {
    aggregateId: parentUser.id,
    messageType: 'PARENT_ACTIVATION',
    dedupeKey: activation.tokenHash,
    to: parentEmail,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });

  return { parentUserId: parentUser.id, parentCreated: true, children: createdChildren };
}

export function createPaperEntryFamilyHandler(
  dependencies: PaperEntryFamilyDependencies = defaultDependencies,
): (request: NextRequest) => Promise<NextResponse> {
  return async (request) => {
    try {
      const input = await requestBody(request);
      const actor = assertStaffActor(await dependencies.authenticate());
      // Un renvoi réseau ne doit pas créer une seconde fois les mêmes enfants :
      // l'adresse du parent est protégée par sa contrainte d'unicité, les
      // enfants ne le sont par rien. La clé d'idempotence, déjà utilisée par
      // les routes canoniques, rend un retry inoffensif.
      const key = parseIdempotencyKey(request.headers.get('idempotency-key'));
      const children = resolveChildren(input);
      const parentEmail = normalizeParentEmail(input.parentEmail);
      const now = dependencies.now();

      const result = await executeIdempotently<FamilyResult>({
        prisma: dependencies.prisma as IdempotencyDatabase,
        userId: actor.userId,
        route: FAMILY_ROUTE,
        key,
        now,
        action: async (transaction: CanonicalTransaction) => ({
          status: 201,
          body: await createFamily(transaction as unknown as Prisma.TransactionClient, {
            input,
            children,
            parentEmail,
            now,
          }),
        }),
      });

      kickEmailOutboxDrain();
      return NextResponse.json(result.body, { status: result.status });
    } catch (error) {
      return canonicalErrorResponse(error);
    }
  };
}
