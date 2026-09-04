/**
 * Server-only persistence for ProfilCandidat (Track A, Section 12).
 *
 * A staff-managed, re-usable candidate academic profile — distinct
 * bounded context from Quote (lib/quotes/persistence.server.ts). Always
 * linked to exactly one of ContactLead/Student, never neither (an orphan
 * profile has no identity to attach a quote to), and never both at once
 * at creation time (the public/staff distinction the rest of the quote
 * domain already relies on).
 */
import 'server-only';
import { Prisma } from '@prisma/client';
import type { BrancheBascule, CandidateLevel, Modalite, ProfilCandidat, Subject } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  jsonValueSchema,
  type DispenseDeclaree,
  type NoteConservee,
  type P3EligibiliteAuditEntry,
  type JsonValue,
} from './candidate-profile-schemas';

/**
 * Single canonical adapter converting validated JSON / domain structures
 * to Prisma-compatible JSON input values.
 * Distinguishes:
 * - undefined => undefined (omit / do not touch in partial updates)
 * - null => Prisma.JsonNull (explicitly store JSON null / clear)
 * - validated JSON value => Prisma.InputJsonValue
 */
export function toPrismaJson<T extends JsonValue>(
  value: T | null | undefined,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  const parsed = jsonValueSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid JSON value for Prisma persistence: ${parsed.error.message}`);
  }
  return parsed.data as unknown as Prisma.InputJsonValue;
}

export interface CreateProfilCandidatInput {
  contactLeadId?: string;
  studentId?: string;
  level: CandidateLevel;
  examSession: number;
  modalite: Modalite;
  specialite1: Subject;
  specialite2: Subject;
  specialiteAbandonnee?: Subject | null;
  langueA?: Subject | null;
  langueB?: Subject | null;
  estRedoublant?: boolean;
  estTitulaireBacDejaObtenu?: boolean;
  changementSpecialite?: boolean;
  intentionAmelioration?: boolean;
  intentionCycleComplet?: boolean;
  brancheBascule?: BrancheBascule | null;
  optionsTerminale?: string[];
  moyenneRattrapage?: number | null;
  etalementPlurisessionsDeclare?: boolean;
  epreuvesDispenseesDeclarees?: string[];
  dispensesDeclarees?: DispenseDeclaree[] | null;
  notesConservees?: NoteConservee[] | null;
  p3EligibiliteAudit?: P3EligibiliteAuditEntry[] | null;
  createdByUserId: string;
}

export async function createProfilCandidat(input: CreateProfilCandidatInput): Promise<ProfilCandidat> {
  if (Boolean(input.contactLeadId) === Boolean(input.studentId)) {
    throw new Error(
      'createProfilCandidat requires exactly one of contactLeadId/studentId (never neither, never both at creation).',
    );
  }

  const data: Prisma.ProfilCandidatUncheckedCreateInput = {
    contactLeadId: input.contactLeadId,
    studentId: input.studentId,
    level: input.level,
    examSession: input.examSession,
    modalite: input.modalite,
    specialite1: input.specialite1,
    specialite2: input.specialite2,
    specialiteAbandonnee: input.specialiteAbandonnee,
    langueA: input.langueA,
    langueB: input.langueB,
    estRedoublant: input.estRedoublant ?? false,
    estTitulaireBacDejaObtenu: input.estTitulaireBacDejaObtenu ?? false,
    changementSpecialite: input.changementSpecialite ?? false,
    intentionAmelioration: input.intentionAmelioration ?? false,
    intentionCycleComplet: input.intentionCycleComplet ?? true,
    brancheBascule: input.brancheBascule,
    optionsTerminale: input.optionsTerminale ?? [],
    moyenneRattrapage: input.moyenneRattrapage ?? null,
    etalementPlurisessionsDeclare: input.etalementPlurisessionsDeclare ?? false,
    epreuvesDispenseesDeclarees: input.epreuvesDispenseesDeclarees ?? [],
    dispensesDeclarees: toPrismaJson(input.dispensesDeclarees) ?? Prisma.JsonNull,
    notesConservees: toPrismaJson(input.notesConservees) ?? Prisma.JsonNull,
    p3EligibiliteAudit: toPrismaJson(input.p3EligibiliteAudit) ?? Prisma.JsonNull,
    createdByUserId: input.createdByUserId,
  };

  return prisma.profilCandidat.create({ data });
}

export async function getProfilCandidatById(id: string): Promise<ProfilCandidat | null> {
  return prisma.profilCandidat.findUnique({ where: { id } });
}

export type ReviseProfilCandidatInput = Partial<Omit<CreateProfilCandidatInput, 'contactLeadId' | 'studentId'>> & {
  createdByUserId: string;
};

/**
 * Creates a NEW ProfilCandidat row chained via previousProfilId — never
 * mutates the original in place (the original stays exactly as any Quote
 * that already snapshotted it saw it). Unspecified fields carry over from
 * the previous revision. previousProfilId is @unique in the schema, so a
 * second concurrent revision attempt of the same profile fails at the
 * database level (P2002) — the DB itself is the lock, never a
 * check-then-write race in application code.
 */
export async function reviseProfilCandidat(
  profilId: string,
  changes: ReviseProfilCandidatInput,
): Promise<ProfilCandidat> {
  const previous = await prisma.profilCandidat.findUniqueOrThrow({ where: { id: profilId } });

  const { createdByUserId, ...fieldChanges } = changes;

  const specialite1 = fieldChanges.specialite1 ?? previous.specialite1;
  const specialite2 = fieldChanges.specialite2 ?? previous.specialite2;
  if (specialite1 === specialite2) {
    throw new Error('specialite1 and specialite2 must be distinct');
  }

  return prisma.profilCandidat.create({
    data: {
      contactLeadId: previous.contactLeadId,
      studentId: previous.studentId,
      level: fieldChanges.level ?? previous.level,
      examSession: fieldChanges.examSession ?? previous.examSession,
      modalite: fieldChanges.modalite ?? previous.modalite,
      specialite1,
      specialite2,
      specialiteAbandonnee:
        fieldChanges.specialiteAbandonnee !== undefined
          ? fieldChanges.specialiteAbandonnee
          : previous.specialiteAbandonnee,
      langueA: fieldChanges.langueA !== undefined ? fieldChanges.langueA : previous.langueA,
      langueB: fieldChanges.langueB !== undefined ? fieldChanges.langueB : previous.langueB,
      estRedoublant: fieldChanges.estRedoublant ?? previous.estRedoublant,
      estTitulaireBacDejaObtenu: fieldChanges.estTitulaireBacDejaObtenu ?? previous.estTitulaireBacDejaObtenu,
      changementSpecialite: fieldChanges.changementSpecialite ?? previous.changementSpecialite,
      intentionAmelioration: fieldChanges.intentionAmelioration ?? previous.intentionAmelioration,
      intentionCycleComplet: fieldChanges.intentionCycleComplet ?? previous.intentionCycleComplet,
      brancheBascule:
        fieldChanges.brancheBascule !== undefined ? fieldChanges.brancheBascule : previous.brancheBascule,
      optionsTerminale: fieldChanges.optionsTerminale ?? previous.optionsTerminale,
      moyenneRattrapage:
        fieldChanges.moyenneRattrapage !== undefined ? fieldChanges.moyenneRattrapage : previous.moyenneRattrapage,
      etalementPlurisessionsDeclare:
        fieldChanges.etalementPlurisessionsDeclare ?? previous.etalementPlurisessionsDeclare,
      epreuvesDispenseesDeclarees:
        fieldChanges.epreuvesDispenseesDeclarees ?? previous.epreuvesDispenseesDeclarees,
      dispensesDeclarees:
        fieldChanges.dispensesDeclarees !== undefined
          ? (toPrismaJson(fieldChanges.dispensesDeclarees) ?? Prisma.JsonNull)
          : (toPrismaJson(previous.dispensesDeclarees as JsonValue | null) ?? Prisma.JsonNull),
      notesConservees:
        fieldChanges.notesConservees !== undefined
          ? (toPrismaJson(fieldChanges.notesConservees) ?? Prisma.JsonNull)
          : (toPrismaJson(previous.notesConservees as JsonValue | null) ?? Prisma.JsonNull),
      p3EligibiliteAudit:
        fieldChanges.p3EligibiliteAudit !== undefined
          ? (toPrismaJson(fieldChanges.p3EligibiliteAudit) ?? Prisma.JsonNull)
          : (toPrismaJson(previous.p3EligibiliteAudit as JsonValue | null) ?? Prisma.JsonNull),
      createdByUserId,
      previousProfilId: previous.id,
      revisionNumber: previous.revisionNumber + 1,
    },
  });
}
