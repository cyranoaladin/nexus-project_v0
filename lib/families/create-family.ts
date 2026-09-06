import { issueParentPhoneChallenge } from '@/lib/auth/parent-phone';
import { enqueueParentWhatsAppInvitation } from '@/lib/whatsapp/invitation-outbox';
import { kickParentWhatsAppOutboxDrain } from '@/lib/whatsapp/invitation-scheduler';
import { candidateProfileAcademicSchema } from '@/lib/quotes/candidate-profile-schemas';
import { getCandidateProfileWorkflowStatus } from '@/lib/quotes/candidate-profile-flag';
import { createProfilCandidat } from '@/lib/quotes/candidate-profile-persistence.server';
import { createId } from '@paralleldrive/cuid2';
import { Prisma } from '@prisma/client';
import type { GradeLevel, PrismaClient } from '@prisma/client';
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

import { CanonicalApiError } from '@/lib/bilans/api/errors';
import { canonicalErrorResponse } from '@/lib/bilans/api/http';
import {
  executeIdempotently,
  parseIdempotencyKey,
  type CanonicalTransaction,
  type IdempotencyDatabase,
} from '@/lib/bilans/api/idempotency';
import { assertStaffActor } from '@/lib/bilans/saisie-papier/access';
import {
  attachRequiresConfirmation,
  classifyHouseholdMatch,
  compareByStrength,
  type HouseholdMatchStrength,
} from '@/lib/bilans/saisie-papier/household-matching';

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
  email: z.string().trim().email().max(160).optional(),
  candidateProfile: candidateProfileAcademicSchema.optional(),
  schoolingStatus: z.enum(['SCHOOL_ENROLLED', 'INDIVIDUAL']).optional(),
  school: z.string().trim().max(120).optional(),
}).strict();

export const PAPER_ENTRY_MAX_CHILDREN = 6;

const requestSchema = z.object({
  parentEmail: z.union([z.string().trim().email().max(160), z.literal('')]).optional(),
  parentPhone: z.string().trim().min(1).max(40),
  parentFirstName: z.string().trim().min(1).max(80),
  parentLastName: z.string().trim().min(1).max(80),
  children: z.array(childSchema).min(1).max(PAPER_ENTRY_MAX_CHILDREN),
  duplicateResolution: z.discriminatedUnion('mode', [
    z.object({
      mode: z.literal('ATTACH'),
      parentUserId: z.string().trim().min(1).max(80),
      // Confirmation délibérée exigée sur un signal faible (homonymie sans
      // téléphone commun) : le rattachement réflexe est ainsi impossible.
      confirmed: z.literal(true).optional(),
    }).strict(),
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
  inviteParent?: (transaction: Prisma.TransactionClient, userId: string, now: Date) => Promise<{ queued: boolean }>;
}>;

const defaultDependencies: PaperEntryFamilyDependencies = {
  prisma,
  authenticate: auth,
  now: () => new Date(),
};

type ResolvedChild = Readonly<{
  email?: string;
  candidateProfile?: z.infer<typeof candidateProfileAcademicSchema>;
  schoolingStatus?: 'SCHOOL_ENROLLED' | 'INDIVIDUAL';
  school?: string;
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
  phoneNormalized: string | null;
  mergedSources: readonly Readonly<{ phoneNormalized: string | null }>[];
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
  /** Force du signal : téléphone identique, homonymie, homonymie + niveau. */
  matchStrength: HouseholdMatchStrength;
  children: readonly Readonly<{
    studentId: string;
    studentName: string;
    gradeLevel: GradeLevel;
  }>[];
}>;

type PotentialDuplicateResult = Readonly<{
  error: Readonly<{ code: 'POTENTIAL_DUPLICATE' }>;
  /** Téléphone tel que saisi (affichage), pour montrer la divergence côté UI. */
  enteredPhone: string;
  candidates: readonly PaperEntryDuplicateCandidate[];
}>;

type ClassifiedCandidate = Readonly<{
  record: DuplicateCandidateRecord;
  strength: HouseholdMatchStrength;
}>;

type FamilyResponse = FamilyResult | PotentialDuplicateResult;

function resolveChildren(input: z.infer<typeof requestSchema>): readonly ResolvedChild[] {
  return input.children.map((child) => {
    const gTrack = normalizeStudentLevelAndTrack(child.grade);
    if (gTrack === null) throw CanonicalApiError.badRequest('STUDENT_GRADE_UNKNOWN');
    if (child.candidateProfile && (
      child.schoolingStatus !== 'INDIVIDUAL'
      || typeof child.candidateProfile.estRedoublant !== 'boolean'
      || typeof child.candidateProfile.estTitulaireBacDejaObtenu !== 'boolean'
      || typeof child.candidateProfile.changementSpecialite !== 'boolean'
      || child.candidateProfile.level !== gTrack.level
      || !child.candidateProfile.examSession || child.candidateProfile.examSession < 2000
      || child.candidateProfile.specialite1 === child.candidateProfile.specialite2
    )) throw CanonicalApiError.badRequest('CANDIDATE_PROFILE_INCONSISTENT');
    return {
      candidateProfile: child.candidateProfile,
      email: child.email ? normalizeParentEmail(child.email) : undefined,
      schoolingStatus: child.schoolingStatus,
      school: child.school,
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

function projectDuplicateCandidate(candidate: ClassifiedCandidate): PaperEntryDuplicateCandidate {
  const { record, strength } = candidate;
  return Object.freeze({
    parentUserId: record.id,
    parentName: displayName(record.firstName, record.lastName, 'Parent'),
    phone: record.phone,
    matchStrength: strength,
    children: Object.freeze((record.parentProfile?.children ?? []).map((child) => Object.freeze({
      studentId: child.id,
      studentName: displayName(child.user.firstName, child.user.lastName, 'Élève'),
      gradeLevel: child.gradeLevel,
    }))),
  });
}

/**
 * Qualifie un candidat remonté par la recherche en lui associant sa force de
 * signal (téléphone fort, homonymie faible), ou l'écarte si plus aucun signal
 * ne le relie au foyer saisi. La classification en mémoire reste l'autorité :
 * elle applique `normalizeNameKey`, cohérente avec la clé SQL indexée. Les
 * candidats sont triés du signal fort vers l'homonymie.
 */
function classifyCandidates(
  records: readonly DuplicateCandidateRecord[],
  input: z.infer<typeof requestSchema>,
  phoneNormalized: string,
  children: readonly ResolvedChild[],
): readonly ClassifiedCandidate[] {
  const childLevels = children.map((child) => child.level);
  return records
    .flatMap((record) => {
      const strength = classifyHouseholdMatch(
        {
          parentFirstName: input.parentFirstName,
          parentLastName: input.parentLastName,
          phoneNormalized,
          childLevels,
        },
        {
          parentFirstName: record.firstName,
          parentLastName: record.lastName,
          phoneNormalized: record.phoneNormalized,
          mergedSourcePhonesNormalized: record.mergedSources
            .map((source) => source.phoneNormalized)
            .filter((value): value is string => value !== null),
          childLevels: (record.parentProfile?.children ?? []).map((child) => child.gradeLevel),
        },
      );
      return strength === null ? [] : [{ record, strength }];
    })
    .sort((a, b) => compareByStrength(a.strength, b.strength));
}

async function findPotentialDuplicateFamilies(
  transaction: Prisma.TransactionClient,
  phoneNormalized: string,
  input: z.infer<typeof requestSchema>,
): Promise<readonly DuplicateCandidateRecord[]> {
  // Résolution des identifiants candidats en SQL, pour comparer les noms sur
  // leur clé NORMALISÉE (`nexus_household_name_key` : casse, accents, traits
  // d'union, apostrophes, espaces multiples). Une comparaison Prisma
  // `insensitive` ne plierait que la casse et laisserait « ben-rhouma » ou
  // « Bén Rhouma » échapper à la recherche. La même fonction indexée sert des
  // deux côtés de l'égalité — aucune dérive entre la valeur stockée et la
  // valeur saisie.
  const matches = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT u.id
    FROM users u
    WHERE u.role = 'PARENT'
      AND u."mergedIntoUserId" IS NULL
      AND (
        u."phoneNormalized" = ${phoneNormalized}
        OR EXISTS (
          SELECT 1 FROM users s
          WHERE s."mergedIntoUserId" = u.id
            AND s."phoneNormalized" = ${phoneNormalized}
        )
        OR nexus_household_name_key(u."firstName", u."lastName")
             = nexus_household_name_key(${input.parentFirstName}, ${input.parentLastName})
      )
    ORDER BY u."createdAt" ASC
    LIMIT 10`);
  const ids = matches.map((row) => row.id);
  if (ids.length === 0) return [];

  const records = await transaction.user.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      phoneNormalized: true,
      mergedSources: { select: { phoneNormalized: true } },
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
  });
  // `findMany({ in })` ne garantit pas l'ordre : on rétablit l'ordre de
  // création déjà fixé par la requête SQL.
  const byId = new Map(records.map((record) => [record.id, record]));
  return ids.flatMap((id) => {
    const record = byId.get(id);
    return record === undefined ? [] : [record];
  });
}

const legacyRequestSchema = z.object({
  parentEmail: z.string().trim().email().optional(),
  parentFirstName: z.string().trim().min(1).max(80),
  parentLastName: z.string().trim().min(1).max(80),
  parentPhone: z.string().trim().min(1).max(40),
  studentFirstName: z.string().trim().min(1).max(80),
  studentLastName: z.string().trim().min(1).max(80),
  studentEmail: z.string().trim().email().optional(),
  studentGrade: z.string().trim().min(1).max(80),
  studentSchool: z.string().trim().max(120).optional(),
}).strict();

async function requestBody(request: NextRequest, legacy = false): Promise<z.infer<typeof requestSchema>> {
  try {
    const raw = await request.json();
    if (legacy && typeof raw === 'object' && raw !== null && !('children' in raw)) {
      const value = legacyRequestSchema.parse(raw);
      return requestSchema.parse({
        parentEmail: value.parentEmail, parentPhone: value.parentPhone,
        parentFirstName: value.parentFirstName, parentLastName: value.parentLastName,
        children: [{ firstName: value.studentFirstName, lastName: value.studentLastName, email: value.studentEmail, grade: value.studentGrade, school: value.studentSchool }],
      });
    }
    return requestSchema.parse(raw);
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
    mode: FamilyMode;
    createdByUserId: string;
  }>,
): Promise<readonly CreatedChild[]> {
  const created: CreatedChild[] = [];
  for (const child of input.children) {
    const activation = input.parentEmail === null || input.mode === 'WHATSAPP' ? null : createActivationToken('student');
    const user = await transaction.user.create({
      data: {
        email: child.email ?? buildStudentLoginIdentifier({
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
        ...(child.schoolingStatus ? { schoolingStatus: child.schoolingStatus } : {}),
        ...(child.school ? { school: child.school } : {}),
      },
      select: { id: true },
    });
    if (child.candidateProfile) {
      await createProfilCandidat({ ...child.candidateProfile, studentId: student.id, createdByUserId: input.createdByUserId }, transaction);
    }
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
    mode: FamilyMode;
    createdByUserId: string;
  }>,
): Promise<FamilyResult> {
  const { input, children, parentEmail, parentPhone, attachTo, now, mode, createdByUserId } = context;
  const { preparePending } = createParentStudentConsentContext(transaction);

  if (attachTo !== undefined && mode === 'WHATSAPP') {
    const profileId = attachTo.parentProfile?.id
      ?? (await transaction.parentProfile.create({ data: { userId: attachTo.id } })).id;
    await transaction.user.update({ where: { id: attachTo.id }, data: { registrationCompletedAt: null } });
    return {
      parentUserId: attachTo.id,
      parentCreated: false,
      children: await createChildren(transaction, preparePending, {
        parentUserId: attachTo.id, parentProfileId: profileId, parentEmail: attachTo.email, children, now, mode, createdByUserId,
      }),
    };
  }

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
        mode,
        createdByUserId,      }),
    };
  }

  const existing = parentEmail === null
    ? null
    : await transaction.user.findUnique({
        where: { email: parentEmail },
        select: { id: true, role: true, mergedIntoUserId: true, parentProfile: { select: { id: true } } },
      });

  // Parent déjà connu : on lui rattache les enfants et actualise seulement le
  // téléphone fourni. Ni son mot de passe, ni son état d'activation ne sont
  // réécrits — un parent déjà activé le reste, un parent en attente aussi.
  if (existing !== null) {
    if (existing.mergedIntoUserId) throw CanonicalApiError.conflict('PARENT_EMAIL_MERGED');
    if (input.duplicateResolution?.mode === 'CREATE_NEW') throw CanonicalApiError.conflict('PARENT_EMAIL_ALREADY_USED');
    if (existing.role !== 'PARENT') throw CanonicalApiError.conflict('PARENT_EMAIL_ROLE_CONFLICT');
    await transaction.user.update({
      where: { id: existing.id },
      data: mode === 'WHATSAPP' ? { registrationCompletedAt: null } : { phone: parentPhone.display, phoneNormalized: parentPhone.normalized },
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
        mode,
        createdByUserId,      }),
    };
  }

  const activation = parentEmail === null || mode === 'WHATSAPP' ? null : createParentActivationToken(now);
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
    mode,
    createdByUserId,
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

type FamilyMode = 'PAPER_ENTRY' | 'WHATSAPP';

async function inviteParentToComplete(transaction: Prisma.TransactionClient, userId: string, now: Date): Promise<{ queued: boolean }> {
  const parent = await transaction.user.findUnique({ where: { id: userId }, select: { activatedAt: true } });
  if (parent?.activatedAt) return { queued: false };
  const challenge = await issueParentPhoneChallenge(transaction, { userId, purpose: 'ACTIVATION', now });
  await enqueueParentWhatsAppInvitation(transaction, { userId, ...challenge, purpose: 'ACTIVATION' });
  return { queued: true };
}

export function createFamilyHandler(
  dependencies: PaperEntryFamilyDependencies = defaultDependencies,
  options: { mode?: FamilyMode; route?: string; legacy?: boolean } = {},
): (request: NextRequest) => Promise<NextResponse> {
  return async (request) => {
    try {
      const actor = assertStaffActor(await dependencies.authenticate());
      const input = await requestBody(request, options.legacy);
      // Un renvoi réseau ne doit pas créer une seconde fois les mêmes enfants :
      // l'adresse du parent est protégée par sa contrainte d'unicité, les
      // enfants ne le sont par rien. La clé d'idempotence, déjà utilisée par
      // les routes canoniques, rend un retry inoffensif.
      const key = parseIdempotencyKey(request.headers.get('idempotency-key'));
      const children = resolveChildren(input);
      if (children.some(child => child.candidateProfile) && await getCandidateProfileWorkflowStatus() !== 'ACTIVE_INTERNAL') {
        return NextResponse.json({ error: { code: 'CANDIDATE_PIPELINE_UNAVAILABLE' } }, { status: 403 });
      }
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
        route: options.route ?? FAMILY_ROUTE,
        key,
        now,
        action: async (transaction: CanonicalTransaction) => {
          const familyTransaction = transaction as unknown as Prisma.TransactionClient;
          const suppliedEmails = children.flatMap(child => child.email ? [child.email] : []);
          if (new Set(suppliedEmails).size !== suppliedEmails.length || suppliedEmails.includes(parentEmail ?? '')) {
            throw CanonicalApiError.conflict('STUDENT_EMAIL_ALREADY_USED');
          }
          for (const email of suppliedEmails) {
            if (await familyTransaction.user.findUnique({ where: { email }, select: { id: true } })) {
              throw CanonicalApiError.conflict('STUDENT_EMAIL_ALREADY_USED');
            }
          }
          const records = await findPotentialDuplicateFamilies(
            familyTransaction,
            parentPhone.normalized,
            input,
          );
          const candidates = classifyCandidates(records, input, parentPhone.normalized, children);
          const resolution = input.duplicateResolution;
          if (candidates.length > 0 && resolution === undefined) {
            return {
              status: 409,
              body: Object.freeze({
                error: Object.freeze({ code: 'POTENTIAL_DUPLICATE' as const }),
                enteredPhone: parentPhone.display,
                candidates: Object.freeze(candidates.map(projectDuplicateCandidate)),
              }),
            };
          }

          const attachTo = resolution?.mode === 'ATTACH'
            ? candidates.find(({ record }) => record.id === resolution.parentUserId)
            : undefined;
          if (resolution?.mode === 'ATTACH') {
            if (attachTo === undefined) {
              throw CanonicalApiError.conflict('POTENTIAL_DUPLICATE_SELECTION_INVALID');
            }
            // Le rattachement sur un signal faible (homonymie sans téléphone
            // commun) n'est jamais implicite : sans la confirmation délibérée,
            // on refuse plutôt que d'envoyer le bilan au mauvais foyer.
            if (attachRequiresConfirmation(attachTo.strength) && resolution.confirmed !== true) {
              throw CanonicalApiError.conflict('ATTACH_REQUIRES_CONFIRMATION');
            }
          }

          const family = await createFamily(familyTransaction, {
            input, children, parentEmail, parentPhone, attachTo: attachTo?.record, now,
            mode: options.mode ?? 'PAPER_ENTRY', createdByUserId: actor.userId,
          });
          if (options.mode === 'WHATSAPP') {
            const invitation = await (dependencies.inviteParent ?? inviteParentToComplete)(familyTransaction, family.parentUserId, now);
            return { status: 201, body: { ...family, invitationQueued: invitation.queued, registrationCompleted: false } };
          }
          return { status: 201, body: family };
        },
      });

      if (result.status === 201) {
        if (options.mode === 'WHATSAPP') kickParentWhatsAppOutboxDrain();
        else kickEmailOutboxDrain();
      }
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
