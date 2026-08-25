/**
 * ParcoursType resolution — a DERIVED operational classification, never a
 * source of regulatory truth and never user-selected (mission §3, §8:
 * ProfilCandidat -> CarteExamen -> ParcoursType, never the reverse). See
 * docs/candidat-individuel/ADR-PARCOURS-P1-P12.md for the taxonomy and the
 * evidence behind each code.
 *
 * P9 (changement de spécialité) is not among the 11 principal codes — it's
 * a non-exclusive modifier, always reported alongside whichever principal
 * parcours resolves (ADR Q6).
 *
 * REVISED after review (2026-08-25): a profile can trigger more than one
 * principal parcours' conditions at once (e.g. a redoublant who is also
 * déjà titulaire du bac). The previous version picked one via an ordered
 * chain and silently discarded the rest. This version evaluates every
 * candidate parcours independently first, then applies the same documented
 * priority order only to pick which one is "principal" — every other
 * matched fact is preserved in faitsConcurrents rather than lost.
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

export interface ParcoursModificateur {
  code: 'P9_CHANGEMENT_SPECIALITE';
  actif: boolean;
}

/** A principal-parcours candidate whose triggering condition matched the profile, whether or not it was ultimately selected. */
export interface ParcoursCandidateFact {
  parcours: ParcoursTypeCode;
  requiresHumanReview: boolean;
  reason?: string;
}

export interface ParcoursResolution {
  parcoursPrincipal: ParcoursTypeCode;
  modificateurs: ParcoursModificateur[];
  /** Every OTHER principal parcours whose condition also matched, with its own reason — never silently dropped. */
  faitsConcurrents: ParcoursCandidateFact[];
  raisonChoixPrincipal: string;
  reglesPrioriteAppliquees: string;
  avertissements: string[];
  requiresHumanReview: boolean;
}

const SECOND_GROUPE_MOYENNE_MIN = 8;
const SECOND_GROUPE_MOYENNE_MAX = 10;

/**
 * Priority order — a DESIGN DECISION, not a sourced regulatory rule — no
 * text found anywhere establishes what happens when several triggering
 * facts co-occur on one profile. Most consequential first:
 *
 *   P12 (étalement, manuel assisté) > P11 (second groupe, produit
 *   autonome à fenêtre courte) > P7 (titulaire, change tout le périmètre
 *   facturable) > P8 (bascule, situation transitoire ponctuelle) >
 *   P4/P5/P6 (redoublement) > P3 (bac accéléré, seulement si explorée) >
 *   P10 (anticipées seules) > P1/P2 (défaut).
 *
 * Deliberately a simple ordered list (not a scoring/priority table) so
 * it stays easy to reorder later without touching call sites — chosen for
 * low coupling and reversibility per mission §3.3's fallback instruction.
 */
const PRIORITY_ORDER: ParcoursTypeCode[] = [
  'P12_ETALEMENT_PLURISESSIONS',
  'P11_SECOND_GROUPE',
  'P7_TITULAIRE_BAC',
  'P8_SCOLARISE_VERS_LIBRE',
  'P4_REDOUBLEMENT_PREMIERE',
  'P5_REDOUBLEMENT_TERMINALE',
  'P6_AMELIORATION_ET_TERMINALE',
  'P3_LIBRE_1AN_DEROGATION',
  'P10_EPREUVES_ANTICIPEES_SEULES',
  'P1_LIBRE_2ANS_MODALITE_A',
  'P2_LIBRE_2ANS_MODALITE_B',
];

const PRIORITY_ORDER_DESCRIPTION =
  'P12 > P11 > P7 > P8 > P4/P5/P6 > P3 (si explorée) > P10 > P1/P2 (défaut) — décision de conception documentée, ADR-PARCOURS-P1-P12.md, non sourcée réglementairement.';

/** Evaluates every principal parcours' trigger condition independently — never short-circuits, so no matched fact is lost. */
function evaluateAllCandidates(policy: ExamPolicy, input: ResolveParcoursInput): ParcoursCandidateFact[] {
  const { profil } = input;
  const facts: ParcoursCandidateFact[] = [];

  if (profil.etalementPlurisessionsDeclare) {
    facts.push({
      parcours: 'P12_ETALEMENT_PLURISESSIONS',
      requiresHumanReview: true,
      reason:
        "Étalement plurisessions déclaré — carte déclarative contrôlée, validation humaine obligatoire avant toute émission (mission §3.3).",
    });
  }

  if (
    profil.moyenneRattrapage != null &&
    profil.moyenneRattrapage >= SECOND_GROUPE_MOYENNE_MIN &&
    profil.moyenneRattrapage <= SECOND_GROUPE_MOYENNE_MAX
  ) {
    facts.push({ parcours: 'P11_SECOND_GROUPE', requiresHumanReview: false });
  }

  if (profil.estTitulaireBacDejaObtenu) {
    const hasDeclaredDispensations = profil.epreuvesDispenseesDeclarees.length > 0;
    facts.push({
      parcours: 'P7_TITULAIRE_BAC',
      requiresHumanReview: hasDeclaredDispensations,
      reason: hasDeclaredDispensations
        ? "Dispenses déclarées par le candidat (arrêté du 14 mai 2020) — Nexus ne peut pas vérifier la déclaration elle-même, revue humaine requise avant émission."
        : undefined,
    });
  }

  if (profil.brancheBascule != null) {
    facts.push({ parcours: 'P8_SCOLARISE_VERS_LIBRE', requiresHumanReview: false });
  }

  if (profil.estRedoublant) {
    if (profil.level === 'PREMIERE') {
      facts.push({ parcours: 'P4_REDOUBLEMENT_PREMIERE', requiresHumanReview: false });
    } else {
      facts.push({
        parcours: profil.intentionAmelioration ? 'P6_AMELIORATION_ET_TERMINALE' : 'P5_REDOUBLEMENT_TERMINALE',
        requiresHumanReview: false,
      });
    }
  }

  if (input.bacAccelereEligibilityAnswers) {
    const eligibility = checkSameSessionEligibility(policy, input.bacAccelereEligibilityAnswers);
    if (eligibility.outcome !== 'NOT_ELIGIBLE_STANDARD_TWO_SESSION_PATH') {
      facts.push({
        parcours: 'P3_LIBRE_1AN_DEROGATION',
        requiresHumanReview: eligibility.outcome === 'ELIGIBILITY_REQUIRES_HUMAN_REVIEW',
        reason: eligibility.outcome === 'ELIGIBILITY_REQUIRES_HUMAN_REVIEW' ? eligibility.reason : undefined,
      });
    }
  }

  if (profil.level === 'PREMIERE' && !profil.intentionCycleComplet) {
    facts.push({ parcours: 'P10_EPREUVES_ANTICIPEES_SEULES', requiresHumanReview: false });
  }

  // P1/P2 default always matches too — it's the fallback "aucune situation
  // particulière" case, always a legitimate candidate even when another
  // fact wins the priority order.
  facts.push({
    parcours: profil.modalite === 'A' ? 'P1_LIBRE_2ANS_MODALITE_A' : 'P2_LIBRE_2ANS_MODALITE_B',
    requiresHumanReview: false,
  });

  return facts;
}

export function resolveParcoursType(policy: ExamPolicy, input: ResolveParcoursInput): ParcoursResolution {
  assertSessionSellable(policy.session);
  const { profil } = input;

  const facts = evaluateAllCandidates(policy, input);

  // Pick the principal by priority order — first matched fact in PRIORITY_ORDER wins.
  const principalIndex = PRIORITY_ORDER.findIndex((code) => facts.some((f) => f.parcours === code));
  const principalCode = PRIORITY_ORDER[principalIndex];
  const principal = facts.find((f) => f.parcours === principalCode)!;
  const faitsConcurrents = facts.filter((f) => f.parcours !== principalCode);

  const raisonChoixPrincipal =
    faitsConcurrents.length === 0
      ? `${principalCode} est la seule situation détectée sur ce profil.`
      : `${principalCode} retenu par priorité (rang ${principalIndex + 1} dans l'ordre documenté) parmi ${facts.length} situations détectées : ${facts.map((f) => f.parcours).join(', ')}.`;

  const avertissements = [principal.reason, ...faitsConcurrents.map((f) => f.reason)].filter(
    (r): r is string => r != null,
  );

  return {
    parcoursPrincipal: principalCode,
    modificateurs: [{ code: 'P9_CHANGEMENT_SPECIALITE', actif: profil.changementSpecialite }],
    faitsConcurrents,
    raisonChoixPrincipal,
    reglesPrioriteAppliquees: PRIORITY_ORDER_DESCRIPTION,
    avertissements,
    requiresHumanReview: principal.requiresHumanReview,
  };
}
