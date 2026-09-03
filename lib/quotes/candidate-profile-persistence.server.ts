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
import type { BrancheBascule, CandidateLevel, Modalite, Prisma, ProfilCandidat, Subject } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface CreateProfilCandidatInput {
  contactLeadId?: string;
  studentId?: string;
  level: CandidateLevel;
  examSession: number;
  modalite: Modalite;
  specialite1: Subject;
  specialite2: Subject;
  specialiteAbandonnee?: Subject;
  langueA?: Subject;
  langueB?: Subject;
  estRedoublant?: boolean;
  estTitulaireBacDejaObtenu?: boolean;
  changementSpecialite?: boolean;
  intentionAmelioration?: boolean;
  intentionCycleComplet?: boolean;
  brancheBascule?: BrancheBascule;
  optionsTerminale?: string[];
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
    createdByUserId: input.createdByUserId,
  };

  return prisma.profilCandidat.create({ data });
}

export async function getProfilCandidatById(id: string): Promise<ProfilCandidat | null> {
  return prisma.profilCandidat.findUnique({ where: { id } });
}
