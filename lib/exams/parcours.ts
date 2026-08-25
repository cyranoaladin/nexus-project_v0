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

/**
 * The mechanism a declared prior note falls under — never inferred, always
 * explicit (mission Lot 4 §4: notesConservees must not become the implicit
 * carrier of two legally distinct mechanisms).
 *
 * - CONSERVATION_DEMANDEE: discretionary request under article D. 334-13
 *   (≥10/20 threshold, 5-session limit, forfeits the mention).
 * - RECONDUCTION_AUTOMATIQUE_CONFIRMEE: article D. 334-7-1's automatic
 *   carry-over, only valid for an immediate consecutive redoublement —
 *   this value asserts that condition has been CONFIRMED (by staff/
 *   assistante review), not guessed from estRedoublant alone. No 10/20
 *   floor, no mention forfeiture (those are D. 334-13-specific).
 * - INDETERMINE: a note fact is known (value, session) but which
 *   mechanism applies hasn't been resolved yet — fails closed with a
 *   specific warning, distinct from "nothing declared at all".
 */
export type MecanismeNote = 'CONSERVATION_DEMANDEE' | 'RECONDUCTION_AUTOMATIQUE_CONFIRMEE' | 'INDETERMINE';

/**
 * Audit trail for a RECONDUCTION_AUTOMATIQUE_CONFIRMEE claim (ADR-dette-
 * reconduction-p3-gates.md Gate 1, closed here). A family/staff member can
 * DECLARE that D. 334-7-1 applies; only a staff member with `statut ===
 * 'VERIFIEE'` can make it load-bearing — lib/exams/carte.ts checks this
 * before ever resolving a confirmed RECONDUITE, regardless of what
 * `mecanisme` says. Additive: this field is optional and mecanisme itself
 * is untouched, so every existing caller/fixture keeps working.
 */
export interface ReconductionAudit {
  /** What was initially declared — informational, never load-bearing alone. */
  mecanismeDeclare: 'CONSERVATION_DEMANDEE' | 'RECONDUCTION_AUTOMATIQUE_DECLAREE' | 'INDETERMINE';
  statutVerification: 'NON_VERIFIEE' | 'VERIFIEE' | 'REFUSEE';
  justificatifRef?: string;
  /** Staff user id — required in practice whenever statutVerification is VERIFIEE (checked by lib/exams/profile-validation.ts, not at the type level, matching the DispenseDeclareeInput precedent). */
  validateurUserId?: string;
  dateValidation?: string;
  /** e.g. "Article D. 334-7-1" — the confirmed mechanism's regulatory basis. */
  sourceReglementaire?: string;
  sessionOrigine?: number;
  sessionCible?: number;
  commentaire?: string;
}

export interface ConservedNoteInput {
  epreuveId: string;
  note: number;
  sessionObtention: number;
  mecanisme: MecanismeNote;
  /** Required (checked by profile-validation.ts) whenever mecanisme === RECONDUCTION_AUTOMATIQUE_CONFIRMEE — never optional in substance, kept optional at the type level for the same reason justificatifRef is on DispenseDeclareeInput. */
  reconductionAudit?: ReconductionAudit | null;
}

/**
 * P7 dispense declaration status — never collapses to a definitive
 * DISPENSEE on the card from DECLAREE alone (mission Lot 4 §3).
 * - DECLAREE: the candidate states they hold this dispensation
 *   (arrêté du 14 mai 2020) — Nexus has not verified it.
 * - CONFIRMEE: staff/assistante has verified the declaration against a
 *   justificatif — only this value may resolve to a firm DISPENSEE.
 * - REFUSEE: declared but found not to apply — treated as A_PRESENTER.
 */
export type StatutDispenseDeclaree = 'DECLAREE' | 'CONFIRMEE' | 'REFUSEE';

export interface DispenseDeclareeInput {
  epreuveId: string;
  statut: StatutDispenseDeclaree;
  /** Reference to the justificatif reviewed — required for CONFIRMEE (Lot 4 §2), checked by lib/exams/profile-validation.ts, not enforced at the type level to keep DECLAREE/REFUSEE entries simple. */
  justificatifRef?: string;
}

/**
 * Audit trail for one P3 (Article 3, same-session dérogation) eligibility
 * condition (ADR-dette-reconduction-p3-gates.md Gate 2, closed here). Never
 * a bare boolean: a family can declare the underlying facts, but only a
 * CONFIRMEE decision by a validated staff member ever makes the condition
 * count as met for a non-autoCheckable condition. autoCheckable conditions
 * (lib/exams/catalog.ts's checkSameSessionEligibility) remain computed
 * automatically as before — this audit trail exists specifically for the
 * non-autoCheckable ones, which a family could otherwise self-assert.
 */
export interface P3EligibiliteAudit {
  /** One of data/exams/*.json's candidatIndividuelRules.sameSessionEligibility.conditions[].id — never a free-text motif. */
  motif: string;
  faitsDeclares: boolean;
  justificatifRequis: boolean;
  justificatifFourni?: string;
  justificatifValide: boolean;
  decision: 'CONFIRMEE' | 'REFUSEE' | 'EN_ATTENTE';
  validateurUserId?: string;
  dateDecision?: string;
  sourceReglementaire: string;
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
  /** @deprecated superseded by dispensesDeclarees (structured, tracks DECLAREE/CONFIRMEE/REFUSEE) — kept only so an old ProfilCandidat row still parses; never read by resolveParcoursType/genererCarteExamen. */
  epreuvesDispenseesDeclarees: string[];
  dispensesDeclarees?: DispenseDeclareeInput[] | null;
  etalementPlurisessionsDeclare: boolean;
  moyenneRattrapage?: number | null;
  optionsTerminale: string[];
  notesConservees?: ConservedNoteInput[] | null;
  /** Staff-only audit trail for non-autoCheckable P3 conditions — never derived from a public form. See deriveEligibilityAnswersFromAudit. */
  p3EligibiliteAudit?: P3EligibiliteAudit[] | null;
}

/**
 * Derives a checkSameSessionEligibility-compatible EligibilityAnswers from
 * the audit trail. Deliberately uniform across every condition — including
 * autoCheckable ones: the policy JSON's autoCheckable flag only means
 * "this fact could in principle be verified automatically" (e.g. a real
 * birthdate field), not "a family's unreviewed self-declaration is
 * sufficient" — no such automated verification exists in this system
 * today, so nothing skips the audit gate. Only `decision === 'CONFIRMEE'`
 * (a staff member's explicit decision) ever yields `true`; a family can
 * declare the underlying facts (faitsDeclares) but can never turn that
 * into a confirmed status by itself. EN_ATTENTE / no entry at all ->
 * undefined (matches the engine's existing "not answered" semantics),
 * never coerced to `false` (which would read as "confirmed non-eligible",
 * stronger than "not yet reviewed").
 */
export function deriveEligibilityAnswersFromAudit(
  audit: P3EligibiliteAudit[] | null | undefined,
): EligibilityAnswers | undefined {
  // No entry at all -> P3 was never explored, distinct from "explored but
  // every condition is still EN_ATTENTE". Returning undefined (not `{}`)
  // preserves resolveParcoursType's "absent means not asked, never treated
  // as not eligible" contract — an empty object is truthy and would
  // wrongly make P3 a candidate fact for every profile.
  if (audit == null || audit.length === 0) return undefined;
  const answers: EligibilityAnswers = {};
  for (const entry of audit) {
    if (entry.decision === 'CONFIRMEE') answers[entry.motif] = true;
    else if (entry.decision === 'REFUSEE') answers[entry.motif] = false;
    // EN_ATTENTE: leave unset — never coerced to a boolean.
  }
  return answers;
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
    // Only DECLAREE/REFUSEE dispensations still need a human look before
    // emission — a CONFIRMEE one has already been through that review.
    const hasUnconfirmedDispensations = (profil.dispensesDeclarees ?? []).some((d) => d.statut !== 'CONFIRMEE');
    facts.push({
      parcours: 'P7_TITULAIRE_BAC',
      requiresHumanReview: hasUnconfirmedDispensations,
      reason: hasUnconfirmedDispensations
        ? "Dispenses déclarées par le candidat (arrêté du 14 mai 2020) et non toutes confirmées — Nexus ne peut pas vérifier une déclaration seule, revue humaine requise avant émission."
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
