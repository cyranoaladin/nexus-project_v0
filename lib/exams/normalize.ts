/**
 * Input normalization for the candidat-individuel pipeline (mission
 * "recâblage" §5) — turns raw, possibly free-text wizard/API input into
 * stable codes. Pure, no pricing logic, no DB. Never guesses: a value that
 * doesn't resolve to a known code is reported as UNRESOLVED (with the
 * original raw string kept for audit), never silently coerced into a
 * plausible default. Absent (never provided) and unresolved (provided but
 * unrecognized) are always distinguished.
 *
 * Layering: this module only produces normalized codes. It never decides
 * whether a profile is valid (lib/exams/profile-validation.ts) or what
 * parcours/carte it resolves to (parcours.ts/carte.ts) — a normalized
 * input still has to pass validateProfilCandidat before it's usable.
 */
import type { Subject } from '@prisma/client';
import { KNOWN_SUBJECTS } from './profile-validation';
import { normalizeOptionCode as normalizeRawOptionCode, KNOWN_OPTION_CODES } from './options';
import type { P3EligibiliteAudit, ReconductionAudit } from './parcours';

export type NormalizationOutcome<T> =
  | { status: 'RESOLVED'; value: T }
  | { status: 'ABSENT' }
  | { status: 'UNRESOLVED'; raw: string };

export function isResolved<T>(o: NormalizationOutcome<T>): o is { status: 'RESOLVED'; value: T } {
  return o.status === 'RESOLVED';
}

/** Case/whitespace-insensitive lookup against KNOWN_SUBJECTS — never fuzzy-matches beyond that (no "closest match" guessing). */
export function normalizeSubject(raw: string | null | undefined): NormalizationOutcome<Subject> {
  if (raw == null || raw.trim() === '') return { status: 'ABSENT' };
  const upper = raw.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (KNOWN_SUBJECTS.has(upper)) return { status: 'RESOLVED', value: upper as Subject };
  return { status: 'UNRESOLVED', raw };
}

export function normalizeLevel(raw: string | null | undefined): NormalizationOutcome<'PREMIERE' | 'TERMINALE'> {
  if (raw == null || raw.trim() === '') return { status: 'ABSENT' };
  const upper = raw.trim().toUpperCase();
  if (upper === 'PREMIERE' || upper === 'PREMIÈRE') return { status: 'RESOLVED', value: 'PREMIERE' };
  if (upper === 'TERMINALE') return { status: 'RESOLVED', value: 'TERMINALE' };
  return { status: 'UNRESOLVED', raw };
}

export function normalizeModalite(raw: string | null | undefined): NormalizationOutcome<'A' | 'B'> {
  if (raw == null || raw.trim() === '') return { status: 'ABSENT' };
  const upper = raw.trim().toUpperCase();
  if (upper === 'A' || upper === 'B') return { status: 'RESOLVED', value: upper };
  return { status: 'UNRESOLVED', raw };
}

/** Wraps lib/exams/options.ts's DGMEC→DGEMC alias table with a known-code check — the alias table itself is never duplicated here. */
export function normalizeOptionCode(raw: string | null | undefined): NormalizationOutcome<string> {
  if (raw == null || raw.trim() === '') return { status: 'ABSENT' };
  const normalized = normalizeRawOptionCode(raw);
  if (KNOWN_OPTION_CODES.has(normalized)) return { status: 'RESOLVED', value: normalized };
  return { status: 'UNRESOLVED', raw };
}

export function normalizeBrancheBascule(
  raw: string | null | undefined,
): NormalizationOutcome<'CONSERVATION_MOYENNES_PREMIERE' | 'RENONCIATION_MOYENNES_PREMIERE'> {
  if (raw == null || raw.trim() === '') return { status: 'ABSENT' };
  const upper = raw.trim().toUpperCase();
  if (upper === 'CONSERVATION_MOYENNES_PREMIERE' || upper === 'RENONCIATION_MOYENNES_PREMIERE') {
    return { status: 'RESOLVED', value: upper };
  }
  return { status: 'UNRESOLVED', raw };
}

// ── Public wizard input (mission §5 — "entrée publique" layer) ──

/**
 * Every field a public wizard could plausibly collect from a family. No
 * mécanisme/dispense/note fields here — those stay staff-only
 * (StaffCandidateInputRaw below), never collectible from a public form
 * (mission §5 "les mécanismes de notes et les dispenses confirmées restent
 * staff-only").
 */
export interface PublicCandidateInputRaw {
  level?: string | null;
  examSession?: number | null;
  modalite?: string | null;
  specialite1?: string | null;
  specialite2?: string | null;
  specialiteAbandonnee?: string | null;
  langueA?: string | null;
  langueB?: string | null;
  optionsTerminale?: string[];
  estRedoublant?: boolean;
  estTitulaireBacDejaObtenu?: boolean;
  changementSpecialite?: boolean;
  intentionAmelioration?: boolean;
  intentionCycleComplet?: boolean;
  moyenneRattrapage?: number | null;
  etalementPlurisessionsDeclare?: boolean;
  brancheBascule?: string | null;
}

export interface NormalizedPublicCandidateInput {
  level: NormalizationOutcome<'PREMIERE' | 'TERMINALE'>;
  examSession: number | null;
  modalite: NormalizationOutcome<'A' | 'B'>;
  specialite1: NormalizationOutcome<Subject>;
  specialite2: NormalizationOutcome<Subject>;
  specialiteAbandonnee: NormalizationOutcome<Subject>;
  langueA: NormalizationOutcome<Subject>;
  langueB: NormalizationOutcome<Subject>;
  optionsTerminale: NormalizationOutcome<string>[];
  estRedoublant: boolean;
  estTitulaireBacDejaObtenu: boolean;
  changementSpecialite: boolean;
  intentionAmelioration: boolean;
  intentionCycleComplet: boolean;
  moyenneRattrapage: number | null;
  etalementPlurisessionsDeclare: boolean;
  brancheBascule: NormalizationOutcome<'CONSERVATION_MOYENNES_PREMIERE' | 'RENONCIATION_MOYENNES_PREMIERE'>;
  /** Raw values kept only for fields that were UNRESOLVED or where normalization changed the value (e.g. DGMEC -> DGEMC) — never a full copy of the input. */
  auditTrail: Record<string, string>;
}

export function normalizePublicCandidateInput(raw: PublicCandidateInputRaw): NormalizedPublicCandidateInput {
  const auditTrail: Record<string, string> = {};
  const track = (field: string, rawValue: string | null | undefined, outcome: NormalizationOutcome<string>) => {
    if (outcome.status === 'UNRESOLVED') auditTrail[field] = outcome.raw;
    else if (outcome.status === 'RESOLVED' && rawValue != null && rawValue.trim().toUpperCase() !== outcome.value) {
      auditTrail[field] = rawValue; // e.g. "DGMEC" resolved to "DGEMC" — keep the original for audit.
    }
  };

  const level = normalizeLevel(raw.level);
  const modalite = normalizeModalite(raw.modalite);
  const specialite1 = normalizeSubject(raw.specialite1);
  const specialite2 = normalizeSubject(raw.specialite2);
  const specialiteAbandonnee = normalizeSubject(raw.specialiteAbandonnee);
  const langueA = normalizeSubject(raw.langueA);
  const langueB = normalizeSubject(raw.langueB);
  const brancheBascule = normalizeBrancheBascule(raw.brancheBascule);
  const optionsTerminale = (raw.optionsTerminale ?? []).map((o) => normalizeOptionCode(o));

  if (level.status === 'UNRESOLVED') auditTrail.level = level.raw;
  if (modalite.status === 'UNRESOLVED') auditTrail.modalite = modalite.raw;
  track('specialite1', raw.specialite1, specialite1);
  track('specialite2', raw.specialite2, specialite2);
  track('specialiteAbandonnee', raw.specialiteAbandonnee, specialiteAbandonnee);
  track('langueA', raw.langueA, langueA);
  track('langueB', raw.langueB, langueB);
  if (brancheBascule.status === 'UNRESOLVED') auditTrail.brancheBascule = brancheBascule.raw;
  optionsTerminale.forEach((o, i) => track(`optionsTerminale[${i}]`, raw.optionsTerminale?.[i], o));

  return {
    level,
    examSession: raw.examSession ?? null,
    modalite,
    specialite1,
    specialite2,
    specialiteAbandonnee,
    langueA,
    langueB,
    optionsTerminale,
    estRedoublant: raw.estRedoublant ?? false,
    estTitulaireBacDejaObtenu: raw.estTitulaireBacDejaObtenu ?? false,
    changementSpecialite: raw.changementSpecialite ?? false,
    intentionAmelioration: raw.intentionAmelioration ?? false,
    intentionCycleComplet: raw.intentionCycleComplet ?? true,
    moyenneRattrapage: raw.moyenneRattrapage ?? null,
    etalementPlurisessionsDeclare: raw.etalementPlurisessionsDeclare ?? false,
    brancheBascule,
    auditTrail,
  };
}

/** True only when every code-bearing field is RESOLVED or legitimately ABSENT (optional fields) — never true while any field is UNRESOLVED. */
export function isFullyNormalized(input: NormalizedPublicCandidateInput): boolean {
  const requiredResolved =
    input.level.status === 'RESOLVED' &&
    input.modalite.status === 'RESOLVED' &&
    input.specialite1.status === 'RESOLVED' &&
    input.specialite2.status === 'RESOLVED';
  const optionalNeverUnresolved =
    input.specialiteAbandonnee.status !== 'UNRESOLVED' &&
    input.langueA.status !== 'UNRESOLVED' &&
    input.langueB.status !== 'UNRESOLVED' &&
    input.brancheBascule.status !== 'UNRESOLVED' &&
    input.optionsTerminale.every((o) => o.status !== 'UNRESOLVED');
  return requiredResolved && optionalNeverUnresolved;
}

// ── Staff-only extension (mission §5 — mécanismes/dispenses jamais côté public) ──

export interface StaffNoteInputRaw {
  epreuveId: string;
  note: number;
  sessionObtention: number;
  mecanisme: 'CONSERVATION_DEMANDEE' | 'RECONDUCTION_AUTOMATIQUE_CONFIRMEE' | 'INDETERMINE';
  /** ADR-dette-reconduction-p3-gates.md Gate 1 — required (checked by lib/exams/carte.ts/profile-validation.ts) whenever mecanisme is RECONDUCTION_AUTOMATIQUE_CONFIRMEE. */
  reconductionAudit?: ReconductionAudit | null;
}

export interface StaffDispenseInputRaw {
  epreuveId: string;
  statut: 'DECLAREE' | 'CONFIRMEE' | 'REFUSEE';
  justificatifRef?: string;
}

export interface StaffCandidateInputExtension {
  notesConservees: StaffNoteInputRaw[];
  dispensesDeclarees: StaffDispenseInputRaw[];
  /** ADR-dette-reconduction-p3-gates.md Gate 2 — the only source of truth for P3 eligibility; a public form never supplies EligibilityAnswers directly (see lib/quotes/pipeline.ts). */
  p3EligibiliteAudit: P3EligibiliteAudit[];
}

/** Pass-through validation only (these already arrive structured from a staff form, never free text) — never normalizes/guesses a mécanisme or statut. */
export function normalizeStaffExtension(raw: {
  notesConservees?: StaffNoteInputRaw[] | null;
  dispensesDeclarees?: StaffDispenseInputRaw[] | null;
  p3EligibiliteAudit?: P3EligibiliteAudit[] | null;
}): StaffCandidateInputExtension {
  return {
    notesConservees: raw.notesConservees ?? [],
    dispensesDeclarees: raw.dispensesDeclarees ?? [],
    p3EligibiliteAudit: raw.p3EligibiliteAudit ?? [],
  };
}
