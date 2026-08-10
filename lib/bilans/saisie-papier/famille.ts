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
import { normalizeParentPhone, type NormalizedParentPhone } from '@/lib/contact/parent-phone';
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
 * Le parent est créé avec `password: null`. Si son e-mail est déjà connu, un
 * jeton d'activation lui est envoyé immédiatement ; sinon l'activation reste
 * différée jusqu'à la complétion de ce contact. Personne — pas même
 * l'assistante qui saisit — ne fixe un mot de passe à sa place.
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

export const PAPER_ENTRY_MAX_CHILDREN = 6;

const requestSchema = z.object({
  parentEmail: z.union([z.string().trim().email().max(160), z.literal('')]).optional(),
  parentPhone: z.string().trim().min(1).max(40),
  parentFirstName: z.string().trim().min(1).max(80),
  parentLastName: z.string().trim().min(1).max(80),
  children: z.array(childSchema).min(1).max(PAPER_ENTRY_MAX_CHILDREN),
  duplicateResolution: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('ATTACH'), parentUserId: z.string().trim().min(1).max(80) }).strict(),
    z.object({ mode: z.literal('CREATE_NEW') }).strict(),
  ]).optional(),
}).strict();

function isUniqueConstraintViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

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

type DuplicateCandidateRecord = Readonly<{
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  parentProfile: Readonly<{
    id: string;
    children: readonly Readonly<{
      id: string;
      gradeLevel: GradeLevel;
      user: Readonly<{ firstName: string | null; lastName: string | null }>;
    }>[];
  }> | null;
}>;

export type PaperEntryDuplicateCandidate = Readonly<{
  parentUserId: string;
  parentName: string;
  phone: string | null;
  children: readonly Readonly<{
    studentId: string;
    studentName: string;
    gradeLevel: GradeLevel;
  }>[];
}>;

type PotentialDuplicateResult = Readonly<{
  error: Readonly<{ code: 'POTENTIAL_DUPLICATE' }>;
  candidates: readonly PaperEntryDuplicateCandidate[];
}>;

type FamilyResponse = FamilyResult | PotentialDuplicateResult;

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

function displayName(firstName: string | null, lastName: string | null, fallback: string): string {
  return `${firstName ?? ''} ${lastName ?? ''}`.trim() || fallback;
}

function projectDuplicateCandidate(candidate: DuplicateCandidateRecord): PaperEntryDuplicateCandidate {
  return Object.freeze({
    parentUserId: candidate.id,
    parentName: displayName(candidate.firstName, candidate.lastName, 'Parent'),
    phone: candidate.phone,
    children: Object.freeze((candidate.parentProfile?.children ?? []).map((child) => Object.freeze({
      studentId: child.id,
      studentName: displayName(child.user.firstName, child.user.lastName, 'Élève'),
      gradeLevel: child.gradeLevel,
    }))),
  });
}

async function findPotentialDuplicateFamilies(
  transaction: Prisma.TransactionClient,
  phoneNormalized: string,
  children: readonly ResolvedChild[],
): Promise<readonly DuplicateCandidateRecord[]> {
  return transaction.user.findMany({
    where: {
      role: 'PARENT',
      mergedIntoUserId: null,
      OR: [
        { phoneNormalized },
        ...children.map((child) => ({
          parentProfile: {
            is: {
              children: {
                some: {
                  gradeLevel: child.level,
                  user: {
                    firstName: { equals: child.firstName, mode: 'insensitive' as const },
                    lastName: { equals: child.lastName, mode: 'insensitive' as const },
                  },
                },
              },
            },
          },
        })),
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      parentProfile: {
        select: {
          id: true,
          children: {
            select: {
              id: true,
              gradeLevel: true,
              user: { select: { firstName: true, lastName: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 10,
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
    parentEmail: string | null;
    children: readonly ResolvedChild[];
    now: Date;
  }>,
): Promise<readonly CreatedChild[]> {
  const created: CreatedChild[] = [];
  for (const child of input.children) {
    const activation = input.parentEmail === null ? null : createActivationToken('student');
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
        activationToken: activation?.tokenHash ?? null,
        activationExpiry: activation?.expiresAt ?? null,
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

    if (activation !== null && input.parentEmail !== null) {
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
    }

    created.push({ studentId: student.id, firstName: child.firstName, gradeLevel: child.level });
  }
  return created;
}

async function createFamily(
  transaction: Prisma.TransactionClient,
  context: Readonly<{
    input: z.infer<typeof requestSchema>;
    children: readonly ResolvedChild[];
    parentEmail: string | null;
    parentPhone: NormalizedParentPhone;
    attachTo?: DuplicateCandidateRecord;
    now: Date;
  }>,
): Promise<FamilyResult> {
  const { input, children, parentEmail, parentPhone, attachTo, now } = context;
  const { preparePending } = createParentStudentConsentContext(transaction);

  if (attachTo !== undefined) {
    let attachedParentEmail = attachTo.email;
    if (attachedParentEmail === null && parentEmail !== null) {
      const activation = createParentActivationToken(now);
      await transaction.user.update({
        where: { id: attachTo.id },
        data: {
          email: parentEmail,
          phone: parentPhone.display,
          phoneNormalized: parentPhone.normalized,
          activationToken: activation.tokenHash,
          activationExpiry: activation.expiresAt,
          sessionVersion: { increment: 1 },
        },
      });
      const message = buildParentActivationEmail({
        parentName: displayName(attachTo.firstName, attachTo.lastName, 'Parent'),
        childFirstName: children[0]?.firstName ?? 'votre enfant',
        rawToken: activation.rawToken,
      });
      await enqueueEmailIntent(transaction, {
        aggregateId: attachTo.id,
        messageType: 'PARENT_ACTIVATION',
        dedupeKey: activation.tokenHash,
        to: parentEmail,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      attachedParentEmail = parentEmail;
    } else {
      await transaction.user.update({
        where: { id: attachTo.id },
        data: { phone: parentPhone.display, phoneNormalized: parentPhone.normalized },
      });
    }
    const profileId = attachTo.parentProfile?.id
      ?? (await transaction.parentProfile.create({ data: { userId: attachTo.id } })).id;
    return {
      parentUserId: attachTo.id,
      parentCreated: false,
      children: await createChildren(transaction, preparePending, {
        parentUserId: attachTo.id,
        parentProfileId: profileId,
        parentEmail: attachedParentEmail,
        children,
        now,
      }),
    };
  }

  const existing = parentEmail === null
    ? null
    : await transaction.user.findUnique({
        where: { email: parentEmail },
        select: { id: true, role: true, parentProfile: { select: { id: true } } },
      });

  // Parent déjà connu : on lui rattache les enfants et actualise seulement le
  // téléphone fourni. Ni son mot de passe, ni son état d'activation ne sont
  // réécrits — un parent déjà activé le reste, un parent en attente aussi.
  if (existing !== null) {
    if (existing.role !== 'PARENT') throw CanonicalApiError.conflict('PARENT_EMAIL_ROLE_CONFLICT');
    await transaction.user.update({
      where: { id: existing.id },
      data: { phone: parentPhone.display, phoneNormalized: parentPhone.normalized },
    });
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

  const activation = parentEmail === null ? null : createParentActivationToken(now);
  const parentUser = await transaction.user.create({
    data: {
      email: parentEmail,
      phone: parentPhone.display,
      phoneNormalized: parentPhone.normalized,
      role: 'PARENT',
      firstName: input.parentFirstName,
      lastName: input.parentLastName,
      // Activation en attente : le parent posera son mot de passe.
      password: null,
      activatedAt: null,
      activationToken: activation?.tokenHash ?? null,
      activationExpiry: activation?.expiresAt ?? null,
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

  if (activation !== null && parentEmail !== null) {
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
  }

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
      let parentPhone: NormalizedParentPhone;
      try {
        parentPhone = normalizeParentPhone(input.parentPhone);
      } catch {
        throw CanonicalApiError.badRequest('PARENT_PHONE_INVALID');
      }
      const parentEmail = input.parentEmail === undefined || input.parentEmail === ''
        ? null
        : normalizeParentEmail(input.parentEmail);
      const now = dependencies.now();

      const result = await executeIdempotently<FamilyResponse>({
        prisma: dependencies.prisma as IdempotencyDatabase,
        userId: actor.userId,
        route: FAMILY_ROUTE,
        key,
        now,
        action: async (transaction: CanonicalTransaction) => {
          const familyTransaction = transaction as unknown as Prisma.TransactionClient;
          const candidates = await findPotentialDuplicateFamilies(
            familyTransaction,
            parentPhone.normalized,
            children,
          );
          const resolution = input.duplicateResolution;
          if (candidates.length > 0 && resolution === undefined) {
            return {
              status: 409,
              body: Object.freeze({
                error: Object.freeze({ code: 'POTENTIAL_DUPLICATE' as const }),
                candidates: Object.freeze(candidates.map(projectDuplicateCandidate)),
              }),
            };
          }

          const attachTo = resolution?.mode === 'ATTACH'
            ? candidates.find(({ id }) => id === resolution.parentUserId)
            : undefined;
          if (resolution?.mode === 'ATTACH' && attachTo === undefined) {
            throw CanonicalApiError.conflict('POTENTIAL_DUPLICATE_SELECTION_INVALID');
          }

          return {
            status: 201,
            body: await createFamily(familyTransaction, {
              input,
              children,
              parentEmail,
              parentPhone,
              attachTo,
              now,
            }),
          };
        },
      });

      if (result.status === 201) kickEmailOutboxDrain();
      return NextResponse.json(result.body, { status: result.status });
    } catch (error) {
      // Deux assistantes créant le même parent au même instant : l'une gagne,
      // l'autre bute sur l'unicité de l'adresse. C'est un conflit ordinaire,
      // pas une panne — le dire évite de faire chercher une erreur serveur
      // là où il suffit de recharger et de rattacher l'enfant au parent
      // désormais existant.
      if (isUniqueConstraintViolation(error)) {
        return canonicalErrorResponse(CanonicalApiError.conflict('PARENT_EMAIL_TAKEN'));
      }
      return canonicalErrorResponse(error);
    }
  };
}
