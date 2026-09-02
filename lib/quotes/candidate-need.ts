/**
 * Canonical candidate need — incrément 3 (candidat-individuel zero-debt),
 * replaces the transitional adaptCatalogueSelectionToExamProfile
 * (lib/quotes/catalogue.ts, removed in incrément 3). Resolved directly
 * from a CatalogueSelection + the CarteExamenResult + ProfilCandidat it
 * came from — no round-trip through the legacy SituationInput/
 * ExamProfileSubject shape.
 *
 * "Fair go-live" Phase A / I3.5: MOD_EDS1/MOD_EDS2/MOD_LVA/MOD_LVB/
 * MOD_SPECIALITE_ABANDONNEE are réglementaire/catalogue POSITIONS, not
 * subjects — this module keeps that distinction explicit rather than
 * collapsing it into one ambiguous field:
 *
 *  - `pedagogicalSlot`: the stable scoring identity
 *    (scoreSubjects/projectDiagnosticCore key on this — the exact same
 *    SubjectId literals as before, NEVER renamed: priority.ts's
 *    diagnostic Map lookup degrades silently to NON_EVALUE on any key
 *    drift). A technical identity, never presented to a family as "the
 *    subject."
 *  - `pedagogicalSubject`: the real Prisma Subject the family actually
 *    chose for that slot (e.g. MATHEMATIQUES for eds1) — null when the
 *    slot isn't candidate-chosen (français, philosophie, Grand Oral,
 *    maths anticipées, enseignement scientifique are fixed, not a
 *    per-candidate choice).
 *  - `humanLabel`: what a parent actually reads — SUBJECT_LABELS[
 *    pedagogicalSubject] when there is one (the canonical map,
 *    lib/quotes/subject-labels.ts, already deduped in incrément 1), else
 *    the module's own fixed French name. Never the generic catalogue
 *    text ("Enseignement de spécialité 1/2").
 */
import 'server-only';
import type { Subject } from '@prisma/client';
import type { CarteExamenResult } from '@/lib/exams/carte';
import type { ProfilCandidatInput } from '@/lib/exams/parcours';
import type { CatalogueSelection } from './catalogue';
import { SUBJECT_LABELS } from './subject-labels';
import type { SubjectId } from './schemas';

export interface ResolvedCandidateNeed {
  // Contractual/catalogue identity.
  catalogueModuleId: string;
  coverageKey: string;
  /** Named to match ExamProfileSubject.epreuveIds exactly — scoreSubjects/buildIdealRecommendation take a ResolvedCandidateNeed[] as an ExamProfileSubject[] by structural typing, no changes to priority.ts/pricing.ts required. */
  epreuveIds: string[];
  optionCodes: string[];
  pricingRuleId: string | null;
  /** Delivery policy (petit_groupe / duo / individuel_* / autonomie_guidee_aria / ...). */
  deliveryMode: string;

  // Pedagogical identity.
  /** Same SubjectId literal scoreSubjects/projectDiagnosticCore already key on — never renamed. A technical scoring/catalogue slot, never presented as "the subject." */
  pedagogicalSlot: SubjectId;
  /** The real Prisma Subject the family chose for this slot, when the slot is a candidate choice (EDS1/EDS2/LVA/LVB/spécialité abandonnée) — null for a fixed slot (français, philosophie, Grand Oral, maths anticipées, enseignement scientifique). */
  pedagogicalSubject: Subject | null;
  /** What a parent actually reads — never the generic catalogue text. */
  humanLabel: string;
  coefficient: number;
  defaultCandidateForRegularSupport: boolean;
}

/** Which SubjectId (pedagogicalSlot) a catalogue module represents — a genuine pedagogical classification, not a legacy-shape mapping (mission "fair go-live" Phase A). */
const MODULE_TO_SLOT: Partial<Record<string, SubjectId>> = {
  MOD_EAF_ECRIT_ORAL: 'francais',
  MOD_EAM: 'maths-anticipees',
  MOD_EDS1: 'eds1',
  MOD_EDS2: 'eds2',
  MOD_PHILOSOPHIE: 'philosophie',
  MOD_GRAND_ORAL: 'grand-oral',
  MOD_HG_ARIA: 'histoire-geographie',
  MOD_ES_ARIA: 'enseignement-scientifique',
  MOD_LVA: 'lva',
  MOD_LVB: 'lvb',
  MOD_SPECIALITE_ABANDONNEE: 'specialite-abandonnee',
};

/** Fixed (non-candidate-chosen) slots' human names — the handful with no Subject-enum equivalent to key SUBJECT_LABELS on. */
const FIXED_SLOT_LABELS: Partial<Record<SubjectId, string>> = {
  'maths-anticipees': 'Mathématiques anticipées',
  'grand-oral': 'Grand Oral',
  'enseignement-scientifique': 'Enseignement scientifique',
};

/** For a candidate-chosen slot, which ProfilCandidatInput field carries the real Subject. */
function pedagogicalSubjectFor(slot: SubjectId, profil: ProfilCandidatInput): Subject | null {
  switch (slot) {
    case 'eds1':
      return profil.specialite1 as Subject;
    case 'eds2':
      return profil.specialite2 as Subject;
    case 'lva':
      return (profil.langueA as Subject) ?? null;
    case 'lvb':
      return (profil.langueB as Subject) ?? null;
    case 'specialite-abandonnee':
      return (profil.specialiteAbandonnee as Subject) ?? null;
    default:
      return null; // fixed slot — not a candidate choice.
  }
}

function humanLabelFor(slot: SubjectId, pedagogicalSubject: Subject | null, catalogueLabel: string): string {
  if (pedagogicalSubject && SUBJECT_LABELS[pedagogicalSubject]) return SUBJECT_LABELS[pedagogicalSubject];
  return FIXED_SLOT_LABELS[slot] ?? catalogueLabel;
}

export interface CandidateNeedsResolution {
  needs: ResolvedCandidateNeed[];
  /**
   * False whenever a SELECTED module has no known pedagogical
   * classification (invariant E) — the caller (pipeline.ts) turns this
   * into UNPRICED, exactly like the removed adapter's
   * modulesNonRepresentables gate, but without a legacy-mapping table.
   */
  emissionAutomatiqueAutorisee: boolean;
}

export function resolveCandidateNeeds(
  selection: CatalogueSelection,
  carte: CarteExamenResult,
  profil: ProfilCandidatInput,
): CandidateNeedsResolution {
  const needs: ResolvedCandidateNeed[] = [];
  let everySelectedModuleRepresentable = true;

  for (const m of selection.modules) {
    if (m.status !== 'SELECTED') continue; // EXCLUDED: genuinely not needed (invariant D — never a silent drop of an actual need).

    const slot = MODULE_TO_SLOT[m.moduleId];
    if (!slot) {
      everySelectedModuleRepresentable = false; // invariant E — fails closed, never silently ignored.
      continue;
    }

    const pedagogicalSubject = pedagogicalSubjectFor(slot, profil);
    needs.push({
      catalogueModuleId: m.moduleId,
      coverageKey: m.coverageKey,
      epreuveIds: m.epreuveCodes,
      optionCodes: m.optionCodes,
      pricingRuleId: m.pricingRuleId,
      deliveryMode: m.deliveryMode,
      pedagogicalSlot: slot,
      pedagogicalSubject,
      humanLabel: humanLabelFor(slot, pedagogicalSubject, m.label),
      coefficient: m.coefficientEffectif ?? 0,
      defaultCandidateForRegularSupport: m.defaultCandidateForRegularSupport,
    });
  }

  return {
    needs,
    emissionAutomatiqueAutorisee: selection.emissionAutomatiqueAutorisee && everySelectedModuleRepresentable,
  };
}
