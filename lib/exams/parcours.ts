/**
 * ParcoursType resolution — a DERIVED operational classification, never a
 * source of regulatory truth and never user-selected (mission §3, §8:
 * ProfilCandidat -> CarteExamen -> ParcoursType, never the reverse). See
 * docs/candidat-individuel/ADR-PARCOURS-P1-P12.md for the taxonomy and the
 * evidence behind each code.
 *
 * P9 (changement de spécialité) is not a code returned here — it's a
 * non-exclusive modifier, always reported alongside whichever principal
 * parcours resolves (ADR Q6).
 */
import 'server-only';
import { assertSessionSellable, checkSameSessionEligibility, type EligibilityAnswers } from './catalog';
import type { ExamPolicy } from './schema';

export type ParcoursTypeCode =
  | 'P1_LIBRE_2ANS_MODALITE_A'
  | 'P2_LIBRE_2ANS_MODALITE_B'
  | 'P3_LIBRE_1AN_DEROGATION'
  | 'P4_REDOUBLEMENT_PREMIERE'
  | 'P5_REDOUBLEMENT_TERMINALE'
  | 'P6_AMELIORATION_ET_TERMINALE'
  | 'P7_TITULAIRE_BAC'
  | 'P8_SCOLARISE_VERS_LIBRE'
  | 'P10_EPREUVES_ANTICIPEES_SEULES'
  | 'P11_SECOND_GROUPE'
  | 'P12_ETALEMENT_PLURISESSIONS';

export interface ConservedNoteInput {
  epreuveId: string;
  note: number;
  sessionObtention: number;
}

/** Plain, DB-independent mirror of the ProfilCandidat Prisma model — keeps this module pure/testable without a Prisma dependency. */
export interface ProfilCandidatInput {
  level: 'PREMIERE' | 'TERMINALE';
  examSession: number;
  modalite: 'A' | 'B';
  specialite1: string;
  specialite2: string;
  specialiteAbandonnee?: string | null;
  langueA?: string | null;
  langueB?: string | null;
  estRedoublant: boolean;
  estTitulaireBacDejaObtenu: boolean;
  changementSpecialite: boolean;
  intentionAmelioration: boolean;
  intentionCycleComplet: boolean;
  brancheBascule?: 'CONSERVATION_MOYENNES_PREMIERE' | 'RENONCIATION_MOYENNES_PREMIERE' | null;
  epreuvesDispenseesDeclarees: string[];
  etalementPlurisessionsDeclare: boolean;
  moyenneRattrapage?: number | null;
  optionsTerminale: string[];
  notesConservees?: ConservedNoteInput[] | null;
}

export interface ResolveParcoursInput {
  profil: ProfilCandidatInput;
  /** Only meaningful if the candidate explored the Article 3 same-session path — absent means "not asked", never treated as "not eligible". */
  bacAccelereEligibilityAnswers?: EligibilityAnswers;
}

export interface ParcoursResolution {
  parcours: ParcoursTypeCode;
  changementSpecialite: boolean;
  requiresHumanReview: boolean;
  /** Present only when requiresHumanReview is true. */
  reason?: string;
}

const SECOND_GROUPE_MOYENNE_MIN = 8;
const SECOND_GROUPE_MOYENNE_MAX = 10;

/**
 * Resolution order below is a DESIGN DECISION, not a sourced regulatory
 * priority rule — no text found anywhere establishes what happens when
 * several triggering facts co-occur on one profile (e.g. a redoublant who
 * is also déjà titulaire du bac). Chosen order, most consequential first:
 *
 *   P12 (étalement, manuel assisté) > P11 (second groupe, produit
 *   autonome à fenêtre courte) > P7 (titulaire, change tout le périmètre
 *   facturable) > P8 (bascule, situation transitoire ponctuelle) >
 *   P4/P5/P6 (redoublement) > P3 (bac accéléré, seulement si explorée) >
 *   P10 (anticipées seules) > P1/P2 (défaut).
 *
 * Deliberately a simple ordered chain (not a scoring/priority table) so
 * it stays easy to reorder later without touching call sites — chosen for
 * low coupling and reversibility per mission §3.3's fallback instruction.
 */
export function resolveParcoursType(policy: ExamPolicy, input: ResolveParcoursInput): ParcoursResolution {
  assertSessionSellable(policy.session);
  const { profil } = input;
  const changementSpecialite = profil.changementSpecialite;

  if (profil.etalementPlurisessionsDeclare) {
    return {
      parcours: 'P12_ETALEMENT_PLURISESSIONS',
      changementSpecialite,
      requiresHumanReview: true,
      reason:
        "Étalement plurisessions déclaré — carte déclarative contrôlée, validation humaine obligatoire avant toute émission (mission §3.3).",
    };
  }

  if (
    profil.moyenneRattrapage != null &&
    profil.moyenneRattrapage >= SECOND_GROUPE_MOYENNE_MIN &&
    profil.moyenneRattrapage <= SECOND_GROUPE_MOYENNE_MAX
  ) {
    return { parcours: 'P11_SECOND_GROUPE', changementSpecialite, requiresHumanReview: false };
  }

  if (profil.estTitulaireBacDejaObtenu) {
    const hasDeclaredDispensations = profil.epreuvesDispenseesDeclarees.length > 0;
    return {
      parcours: 'P7_TITULAIRE_BAC',
      changementSpecialite,
      requiresHumanReview: hasDeclaredDispensations,
      reason: hasDeclaredDispensations
        ? "Dispenses déclarées par le candidat (arrêté du 14 mai 2020) — Nexus ne peut pas vérifier la déclaration elle-même, revue humaine requise avant émission."
        : undefined,
    };
  }

  if (profil.brancheBascule != null) {
    return { parcours: 'P8_SCOLARISE_VERS_LIBRE', changementSpecialite, requiresHumanReview: false };
  }

  if (profil.estRedoublant) {
    if (profil.level === 'PREMIERE') {
      return { parcours: 'P4_REDOUBLEMENT_PREMIERE', changementSpecialite, requiresHumanReview: false };
    }
    return {
      parcours: profil.intentionAmelioration ? 'P6_AMELIORATION_ET_TERMINALE' : 'P5_REDOUBLEMENT_TERMINALE',
      changementSpecialite,
      requiresHumanReview: false,
    };
  }

  if (input.bacAccelereEligibilityAnswers) {
    const eligibility = checkSameSessionEligibility(policy, input.bacAccelereEligibilityAnswers);
    if (eligibility.outcome !== 'NOT_ELIGIBLE_STANDARD_TWO_SESSION_PATH') {
      return {
        parcours: 'P3_LIBRE_1AN_DEROGATION',
        changementSpecialite,
        requiresHumanReview: eligibility.outcome === 'ELIGIBILITY_REQUIRES_HUMAN_REVIEW',
        reason: eligibility.outcome === 'ELIGIBILITY_REQUIRES_HUMAN_REVIEW' ? eligibility.reason : undefined,
      };
    }
    // NOT_ELIGIBLE_STANDARD_TWO_SESSION_PATH falls through to P1/P2/P10 below.
  }

  if (profil.level === 'PREMIERE' && !profil.intentionCycleComplet) {
    return { parcours: 'P10_EPREUVES_ANTICIPEES_SEULES', changementSpecialite, requiresHumanReview: false };
  }

  return {
    parcours: profil.modalite === 'A' ? 'P1_LIBRE_2ANS_MODALITE_A' : 'P2_LIBRE_2ANS_MODALITE_B',
    changementSpecialite,
    requiresHumanReview: false,
  };
}
