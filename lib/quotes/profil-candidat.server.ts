/**
 * Server-only persistence for ProfilCandidat (mission recâblage §5 —
 * assistante workspace surface for the candidat-individuel pipeline).
 *
 * Before this module, ProfilCandidat existed only as a Prisma model — no
 * lib/ service, no API route, no UI ever created/read/updated a row
 * (confirmed by a repo-wide search before writing this: the only hit was a
 * test fixture). This is new persistence, not a wrapper around something
 * that already existed.
 *
 * A row can only be persisted once its 4 required identity fields (level,
 * modalite, specialite1, specialite2) resolve to a known code — the Prisma
 * columns are non-nullable enums, so a genuinely incomplete draft simply
 * cannot be saved yet; the workspace UI holds it client-side until then.
 * Never silently coerces an UNRESOLVED value into a guess (mirrors
 * lib/exams/normalize.ts's own fail-closed contract).
 */
import 'server-only';
import { prisma } from '@/lib/prisma';
import { Prisma, type ContactLeadStatus, type ProfilCandidat } from '@prisma/client';
import {
  normalizePublicCandidateInput,
  normalizeStaffExtension,
  type PublicCandidateInputRaw,
  type StaffNoteInputRaw,
  type StaffDispenseInputRaw,
} from '@/lib/exams/normalize';
import type { P3EligibiliteAudit } from '@/lib/exams/parcours';
import type { CandidateQuotePipelineInput } from './pipeline';
import type { BudgetInput } from './schemas';
import { lockProfilCandidatForQuote } from './profil-candidat-lock.server';
import { normalizeUserEmail } from '@/lib/contact/user-email';
import { validateLanguagePair, type LanguagePairValidationIssue } from '@/lib/exams/languages';
import { validateSpecialityFields, type SpecialityValidationIssue } from '@/lib/exams/specialities';

export interface ProfilCandidatDraftInput {
  publicInput: PublicCandidateInputRaw;
  staffExtension?: {
    notesConservees?: StaffNoteInputRaw[] | null;
    dispensesDeclarees?: StaffDispenseInputRaw[] | null;
    p3EligibiliteAudit?: P3EligibiliteAudit[] | null;
  };
  contactLeadId?: string | null;
  studentId?: string | null;
}

export interface ProfilCandidatValidationError {
  ok: false;
  /** Fields whose raw value did not resolve to a known code — never guessed, never silently dropped. */
  unresolvedFields: string[];
  /** The 4 required identity fields (level/modalite/specialite1/specialite2) still ABSENT. */
  missingRequiredFields: string[];
  /** Domain violations are never collapsed into unresolved input fields. */
  validationIssues: Array<LanguagePairValidationIssue | SpecialityValidationIssue>;
}

export type ProfilCandidatIdentityErrorCode =
  | 'MISSING_IDENTITY'
  | 'CONTACT_LEAD_NOT_FOUND'
  | 'STUDENT_NOT_FOUND'
  | 'RESPONSIBLE_UNAVAILABLE'
  | 'IDENTITY_MISMATCH';

export interface ProfilCandidatIdentityError {
  ok: false;
  identityError: ProfilCandidatIdentityErrorCode;
}

export class ProfilCandidatIdentityConflictError extends Error {
  constructor(public readonly code: ProfilCandidatIdentityErrorCode) {
    super(code);
    this.name = 'ProfilCandidatIdentityConflictError';
  }
}

type PersistablePayload = Omit<
  Prisma.ProfilCandidatUncheckedCreateInput,
  'id' | 'createdAt' | 'updatedAt' | 'previousProfilId' | 'revisionNumber'
>;

function buildPersistablePayload(input: ProfilCandidatDraftInput): { ok: true; data: PersistablePayload } | ProfilCandidatValidationError {
  const normalized = normalizePublicCandidateInput(input.publicInput);
  const staff = normalizeStaffExtension(input.staffExtension ?? {});
  const languagePair = validateLanguagePair(input.publicInput.langueA, input.publicInput.langueB);
  const specialityIssues = validateSpecialityFields(input.publicInput);

  const unresolvedFields: string[] = [];
  if (normalized.level.status === 'UNRESOLVED') unresolvedFields.push('level');
  if (normalized.modalite.status === 'UNRESOLVED') unresolvedFields.push('modalite');
  if (normalized.brancheBascule.status === 'UNRESOLVED') unresolvedFields.push('brancheBascule');
  normalized.optionsTerminale.forEach((o, i) => {
    if (o.status === 'UNRESOLVED') unresolvedFields.push(`optionsTerminale[${i}]`);
  });

  const missingRequiredFields: string[] = [];
  if (normalized.level.status !== 'RESOLVED') missingRequiredFields.push('level');
  if (normalized.modalite.status !== 'RESOLVED') missingRequiredFields.push('modalite');
  if (normalized.specialite1.status !== 'RESOLVED') missingRequiredFields.push('specialite1');
  if (normalized.specialite2.status !== 'RESOLVED') missingRequiredFields.push('specialite2');

  const validationIssues = [...specialityIssues, ...languagePair.issues];
  if (unresolvedFields.length > 0 || missingRequiredFields.length > 0 || validationIssues.length > 0) {
    return { ok: false, unresolvedFields, missingRequiredFields, validationIssues };
  }

  // Safe: RESOLVED asserted above for all 4 required fields.
  const level = normalized.level as { status: 'RESOLVED'; value: 'PREMIERE' | 'TERMINALE' };
  const modalite = normalized.modalite as { status: 'RESOLVED'; value: 'A' | 'B' };
  const specialite1 = normalized.specialite1 as { status: 'RESOLVED'; value: string };
  const specialite2 = normalized.specialite2 as { status: 'RESOLVED'; value: string };

  const data: PersistablePayload = {
    contactLeadId: input.contactLeadId ?? null,
    studentId: input.studentId ?? null,
    level: level.value,
    examSession: input.publicInput.examSession ?? 0,
    modalite: modalite.value,
    specialite1: specialite1.value as Prisma.ProfilCandidatUncheckedCreateInput['specialite1'],
    specialite2: specialite2.value as Prisma.ProfilCandidatUncheckedCreateInput['specialite2'],
    specialiteAbandonnee: normalized.specialiteAbandonnee.status === 'RESOLVED' ? (normalized.specialiteAbandonnee.value as Prisma.ProfilCandidatUncheckedCreateInput['specialiteAbandonnee']) : null,
    langueA: normalized.langueA.status === 'RESOLVED' ? (normalized.langueA.value as Prisma.ProfilCandidatUncheckedCreateInput['langueA']) : null,
    langueB: normalized.langueB.status === 'RESOLVED' ? (normalized.langueB.value as Prisma.ProfilCandidatUncheckedCreateInput['langueB']) : null,
    estRedoublant: input.publicInput.estRedoublant ?? false,
    estTitulaireBacDejaObtenu: input.publicInput.estTitulaireBacDejaObtenu ?? false,
    changementSpecialite: input.publicInput.changementSpecialite ?? false,
    intentionAmelioration: input.publicInput.intentionAmelioration ?? false,
    brancheBascule: normalized.brancheBascule.status === 'RESOLVED' ? (normalized.brancheBascule.value as Prisma.ProfilCandidatUncheckedCreateInput['brancheBascule']) : null,
    intentionCycleComplet: input.publicInput.intentionCycleComplet ?? true,
    moyenneRattrapage: input.publicInput.moyenneRattrapage ?? null,
    optionsTerminale: normalized.optionsTerminale.map((o) => (o.status === 'RESOLVED' ? o.value : '')).filter(Boolean),
    etalementPlurisessionsDeclare: input.publicInput.etalementPlurisessionsDeclare ?? false,
    notesConservees: staff.notesConservees.length > 0 ? (staff.notesConservees as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
    dispensesDeclarees: staff.dispensesDeclarees.length > 0 ? (staff.dispensesDeclarees as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
    p3EligibiliteAudit: staff.p3EligibiliteAudit.length > 0 ? (staff.p3EligibiliteAudit as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
  };

  return { ok: true, data };
}

export async function validateProfilCandidatIdentity(
  transaction: Prisma.TransactionClient,
  input: Pick<ProfilCandidatDraftInput, 'contactLeadId' | 'studentId'>,
): Promise<{ ok: true } | ProfilCandidatIdentityError> {
  const contactLeadId = input.contactLeadId?.trim();
  const studentId = input.studentId?.trim();
  if (!contactLeadId || !studentId) return { ok: false, identityError: 'MISSING_IDENTITY' };

  // Real PostgreSQL row locks, always in the same cross-table order. Student
  // comes first because its locked parentId/userId define the remaining rows.
  // Unlike an advisory mutex, these serialize ordinary Prisma writers too.
  await transaction.$queryRaw(Prisma.sql`
    SELECT "id", "parentId", "userId" FROM "students"
    WHERE "id" = ${studentId}
    FOR UPDATE
  `);
  await transaction.$queryRaw(Prisma.sql`
    SELECT "id" FROM "contact_leads"
    WHERE "id" = ${contactLeadId}
    FOR UPDATE
  `);
  await transaction.$queryRaw(Prisma.sql`
    SELECT pp."id"
    FROM "parent_profiles" pp
    WHERE pp."id" = (SELECT s."parentId" FROM "students" s WHERE s."id" = ${studentId})
    FOR UPDATE OF pp
  `);
  await transaction.$queryRaw(Prisma.sql`
    SELECT u."id"
    FROM "users" u
    WHERE u."id" = (SELECT s."userId" FROM "students" s WHERE s."id" = ${studentId})
       OR u."id" = (
      SELECT pp."userId"
      FROM "parent_profiles" pp
      WHERE pp."id" = (SELECT s."parentId" FROM "students" s WHERE s."id" = ${studentId})
    )
    ORDER BY u."id"
    FOR UPDATE OF u
  `);

  const [lead, student] = await Promise.all([
    transaction.contactLead.findUnique({ where: { id: contactLeadId }, select: { id: true, email: true } }),
    transaction.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        user: { select: { id: true, mergedIntoUserId: true } },
        parent: { select: { user: { select: { id: true, email: true, mergedIntoUserId: true } } } },
      },
    }),
  ]);
  if (!lead) return { ok: false, identityError: 'CONTACT_LEAD_NOT_FOUND' };
  if (!student) return { ok: false, identityError: 'STUDENT_NOT_FOUND' };
  const parent = student.parent?.user;
  if (student.user.mergedIntoUserId || !parent?.email || parent.mergedIntoUserId) {
    return { ok: false, identityError: 'RESPONSIBLE_UNAVAILABLE' };
  }
  if (normalizeUserEmail(lead.email) !== normalizeUserEmail(parent.email)) {
    return { ok: false, identityError: 'IDENTITY_MISMATCH' };
  }
  return { ok: true };
}

export async function assertProfilCandidatIdentity(
  transaction: Prisma.TransactionClient,
  input: Pick<ProfilCandidatDraftInput, 'contactLeadId' | 'studentId'>,
): Promise<void> {
  const result = await validateProfilCandidatIdentity(transaction, input);
  if (!result.ok) throw new ProfilCandidatIdentityConflictError(result.identityError);
}

export async function createProfilCandidat(
  input: ProfilCandidatDraftInput,
  createdByUserId: string,
): Promise<{ ok: true; profil: ProfilCandidat } | ProfilCandidatValidationError | ProfilCandidatIdentityError> {
  const built = buildPersistablePayload(input);
  if (!built.ok) return built;
  return prisma.$transaction(async (transaction) => {
    const identity = await validateProfilCandidatIdentity(transaction, input);
    if (!identity.ok) return identity;
    const profil = await transaction.profilCandidat.create({ data: { ...built.data, createdByUserId } });
    return { ok: true, profil };
  });
}

export async function updateProfilCandidat(
  id: string,
  input: ProfilCandidatDraftInput,
): Promise<
  | { ok: true; profil: ProfilCandidat }
  | ProfilCandidatValidationError
  | ProfilCandidatIdentityError
  | { ok: false; notFound: true }
  | { ok: false; quoteExists: true }
> {
  return prisma.$transaction(async (transaction) => {
    const lockedProfil = await lockProfilCandidatForQuote(transaction, id);
    if (!lockedProfil) return { ok: false, notFound: true };
    const linkedQuote = await transaction.quote.findFirst({ where: { profilId: id }, select: { id: true } });
    if (linkedQuote) return { ok: false, quoteExists: true };
    const built = buildPersistablePayload(input);
    if (!built.ok) return built;
    const identity = await validateProfilCandidatIdentity(transaction, input);
    if (!identity.ok) return identity;
    const profil = await transaction.profilCandidat.update({ where: { id }, data: built.data });
    return { ok: true, profil };
  });
}

export async function getProfilCandidat(id: string): Promise<ProfilCandidat | null> {
  return prisma.profilCandidat.findUnique({ where: { id } });
}

export interface ProfilCandidatIdentity {
  contactLead: { id: string; name: string; email: string; phone: string | null; status: ContactLeadStatus } | null;
  student: { id: string; user: { firstName: string | null; lastName: string | null; email: string | null } } | null;
}

/**
 * T5R5 §FINDING_11 — the staff workspace needs the ATTACHED identity's
 * display name (not just the raw ids ProfilCandidat itself carries) so it
 * can show "Élève"/"Responsable" when resuming a saved draft. A second,
 * narrowly-scoped read — getProfilCandidat itself stays untouched (its
 * other caller, the quote-creation route, only ever needs the raw ids).
 */
export async function getProfilCandidatWithIdentity(id: string): Promise<(ProfilCandidat & ProfilCandidatIdentity) | null> {
  return prisma.profilCandidat.findUnique({
    where: { id },
    include: {
      contactLead: { select: { id: true, name: true, email: true, phone: true, status: true } },
      student: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
    },
  });
}

export interface ListProfilsCandidatsFilter {
  contactLeadId?: string;
  studentId?: string;
  limit?: number;
}

/** Most-recently-updated first — "resume a draft" is always about picking up the latest state. */
export async function listProfilsCandidats(filter: ListProfilsCandidatsFilter = {}): Promise<ProfilCandidat[]> {
  return prisma.profilCandidat.findMany({
    where: {
      contactLeadId: filter.contactLeadId,
      studentId: filter.studentId,
    },
    orderBy: { updatedAt: 'desc' },
    take: Math.min(filter.limit ?? 25, 100),
  });
}

export async function requestProfilCandidatReview(
  id: string,
  requestedByUserId: string,
  note: string | null,
): Promise<ProfilCandidat | null> {
  const existing = await prisma.profilCandidat.findUnique({ where: { id } });
  if (!existing) return null;
  return prisma.profilCandidat.update({
    where: { id },
    data: { reviewRequestedAt: new Date(), reviewRequestedByUserId: requestedByUserId, reviewNote: note },
  });
}

/**
 * "Créer une révision" — a new row carrying the same declared facts,
 * linked back via previousProfilId, revisionNumber incremented, review
 * state reset (a revision is unreviewed by construction). Never mutates
 * the row it supersedes — both remain queryable, matching the Quote
 * model's own (unwired) previousRevisionId/supersededBy precedent.
 */
export async function createProfilCandidatRevision(id: string, createdByUserId: string): Promise<ProfilCandidat | null> {
  const existing = await prisma.profilCandidat.findUnique({ where: { id } });
  if (!existing) return null;
  return prisma.profilCandidat.create({
    data: {
      contactLeadId: existing.contactLeadId,
      studentId: existing.studentId,
      level: existing.level,
      examSession: existing.examSession,
      modalite: existing.modalite,
      specialite1: existing.specialite1,
      specialite2: existing.specialite2,
      specialiteAbandonnee: existing.specialiteAbandonnee,
      langueA: existing.langueA,
      langueB: existing.langueB,
      estRedoublant: existing.estRedoublant,
      estTitulaireBacDejaObtenu: existing.estTitulaireBacDejaObtenu,
      changementSpecialite: existing.changementSpecialite,
      intentionAmelioration: existing.intentionAmelioration,
      brancheBascule: existing.brancheBascule,
      intentionCycleComplet: existing.intentionCycleComplet,
      moyenneRattrapage: existing.moyenneRattrapage,
      optionsTerminale: existing.optionsTerminale,
      etalementPlurisessionsDeclare: existing.etalementPlurisessionsDeclare,
      notesConservees: existing.notesConservees ?? Prisma.JsonNull,
      dispensesDeclarees: existing.dispensesDeclarees ?? Prisma.JsonNull,
      p3EligibiliteAudit: existing.p3EligibiliteAudit ?? Prisma.JsonNull,
      createdByUserId,
      previousProfilId: existing.id,
      revisionNumber: existing.revisionNumber + 1,
    },
  });
}

/**
 * Reconstructs the pipeline's input shape from a stored row, for "resume a
 * draft" -> re-run simulation. The JSON columns were only ever written by
 * this same module (staff-only, never public-facing) — trusted at the
 * type level, not re-validated against untrusted input here.
 */
export function profilCandidatToPipelineInput(row: ProfilCandidat, budget: BudgetInput, monthsRemaining?: number): CandidateQuotePipelineInput {
  return {
    publicInput: {
      level: row.level,
      examSession: row.examSession,
      modalite: row.modalite,
      specialite1: row.specialite1,
      specialite2: row.specialite2,
      specialiteAbandonnee: row.specialiteAbandonnee,
      langueA: row.langueA,
      langueB: row.langueB,
      optionsTerminale: row.optionsTerminale,
      estRedoublant: row.estRedoublant,
      estTitulaireBacDejaObtenu: row.estTitulaireBacDejaObtenu,
      changementSpecialite: row.changementSpecialite,
      intentionAmelioration: row.intentionAmelioration,
      intentionCycleComplet: row.intentionCycleComplet,
      moyenneRattrapage: row.moyenneRattrapage,
      etalementPlurisessionsDeclare: row.etalementPlurisessionsDeclare,
      brancheBascule: row.brancheBascule,
    },
    staffExtension: {
      notesConservees: (row.notesConservees as unknown as StaffNoteInputRaw[] | null) ?? null,
      dispensesDeclarees: (row.dispensesDeclarees as unknown as StaffDispenseInputRaw[] | null) ?? null,
      p3EligibiliteAudit: (row.p3EligibiliteAudit as unknown as P3EligibiliteAudit[] | null) ?? null,
    },
    budget,
    monthsRemaining,
  };
}
