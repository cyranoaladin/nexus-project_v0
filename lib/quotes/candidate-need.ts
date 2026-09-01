/**
 * Canonical candidate need — incrément 3 (candidat-individuel zero-debt),
 * replaces the transitional adaptCatalogueSelectionToExamProfile
 * (lib/quotes/catalogue.ts, removed in this increment). Resolved directly
 * from a CatalogueSelection + the CarteExamenResult it came from — no
 * round-trip through the legacy SituationInput/ExamProfileSubject shape.
 *
 * Carries both identities a candidate need has (mission §5):
 *  - contractual/catalogue identity (moduleId, coverageKey, épreuve/option
 *    codes, pricing rule, delivery mode) — a réglementaire/catalogue
 *    position (MOD_EDS1, MOD_EDS2, ...);
 *  - pedagogical identity (subject, real label, effective coefficient,
 *    regular-support default) — what a family/teacher actually calls it.
 *
 * `subject` deliberately keeps the exact same SubjectId literals
 * lib/quotes/priority.ts::scoreSubjects and lib/quotes/diagnostic.ts::
 * projectDiagnostic already key on ('eds1', 'eds2', ...) — they match by
 * bare string equality with a SILENT fallback to NON_EVALUE on a miss
 * (priority.ts), so this key must never drift. `label` is the NEW,
 * previously-missing piece: MOD_EDS1/MOD_EDS2 are réglementaire positions,
 * not subjects — the real specialty name (e.g. "Mathématiques") is already
 * resolved once, at carte-generation time, onto the matched épreuve's
 * `.matiere` (lib/exams/carte.ts) — this module reads it from there rather
 * than re-deriving it or re-reading ProfilCandidat.specialite1/2.
 */
import 'server-only';
import type { CarteExamenResult } from '@/lib/exams/carte';
import type { CatalogueSelection } from './catalogue';
import type { SubjectId } from './schemas';

export interface ResolvedCandidateNeed {
  // Contractual/catalogue identity.
  moduleId: string;
  coverageKey: string;
  /** Named to match ExamProfileSubject.epreuveIds exactly — scoreSubjects/buildIdealRecommendation take a ResolvedCandidateNeed[] as an ExamProfileSubject[] by structural typing, no changes to priority.ts/pricing.ts required. */
  epreuveIds: string[];
  optionCodes: string[];
  pricingRuleId: string | null;
  deliveryMode: string;

  // Pedagogical identity.
  /** Same SubjectId literal scoreSubjects/projectDiagnostic already key on — never renamed. */
  subject: SubjectId;
  /** The real specialty/human label (carte épreuve's .matiere when available), never the generic catalogue text. */
  label: string;
  coefficient: number;
  defaultCandidateForRegularSupport: boolean;
}

/**
 * Which SubjectId a catalogue module represents, pedagogically — a genuine
 * classification (every catalogue module needs one of these mapped
 * somewhere, whether or not a legacy shape exists), NOT the removed
 * MODULE_LEGACY_MAPPING (which conflated this with legacy-shape
 * compatibility, mission §7). A module absent here has no known
 * pedagogical representation yet — resolveCandidateNeeds fails closed on
 * it (invariant E), it never gets silently dropped.
 */
const MODULE_TO_SUBJECT: Partial<Record<string, SubjectId>> = {
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

export function resolveCandidateNeeds(selection: CatalogueSelection, carte: CarteExamenResult): CandidateNeedsResolution {
  const needs: ResolvedCandidateNeed[] = [];
  let everySelectedModuleRepresentable = true;

  for (const m of selection.modules) {
    if (m.status !== 'SELECTED') continue; // EXCLUDED: genuinely not needed (invariant D — never a silent drop of an actual need).

    const subject = MODULE_TO_SUBJECT[m.moduleId];
    if (!subject) {
      everySelectedModuleRepresentable = false; // invariant E — fails closed, never silently ignored.
      continue;
    }

    const matched = carte.epreuves.find((e) => m.epreuveCodes.includes(e.code));
    needs.push({
      moduleId: m.moduleId,
      coverageKey: m.coverageKey,
      epreuveIds: m.epreuveCodes,
      optionCodes: m.optionCodes,
      pricingRuleId: m.pricingRuleId,
      deliveryMode: m.deliveryMode,
      subject,
      label: matched?.matiere ?? m.label,
      coefficient: m.coefficientEffectif ?? 0,
      defaultCandidateForRegularSupport: m.defaultCandidateForRegularSupport,
    });
  }

  return {
    needs,
    emissionAutomatiqueAutorisee: selection.emissionAutomatiqueAutorisee && everySelectedModuleRepresentable,
  };
}
