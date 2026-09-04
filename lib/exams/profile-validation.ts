/**
 * validateProfilCandidat — structural/regulatory validation of a
 * ProfilCandidat input, ahead of (and independent from) carte generation
 * (mission Lot 4 §1). Pure, deterministic, no React, no DB, no pricing —
 * same discipline as genererCarteExamen/resolveParcoursType. Session-
 * versioned wherever a check depends on a session rule (reads through
 * ExamPolicy, never hardcodes a threshold/coefficient itself).
 *
 * Deliberately does NOT duplicate genererCarteExamen's épreuve-by-épreuve
 * derivation — it validates the INPUT (data integrity, eligibility,
 * option rules, cross-field consistency) that carte generation and
 * pricing both depend on being sound.
 */
import 'server-only';
import {
  getEpreuve,
  getSessionStatus,
  getSupportedSessions,
  checkSameSessionEligibility,
  resolveConservedNoteCoefficient,
  type EligibilityAnswers,
} from './catalog';
import { isLcaOption, normalizeOptionCode, validateOptionsSelection } from './options';
import { resolveParcoursType, type ProfilCandidatInput } from './parcours';
import type { ExamPolicy, RegulatorySource } from './schema';
import { LANGUAGE_CODES, validateLanguagePair } from './languages';
import { KNOWN_SPECIALITIES, validateSpecialityFields } from './specialities';

export type ValidationSeverity = 'ERROR' | 'WARNING' | 'INFO';

export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  field?: string;
  messageFamille: string;
  messageInterne?: string;
  source?: RegulatorySource;
  blockingForAutomaticQuote: boolean;
}

export interface ProfileValidationResult {
  valide: boolean;
  erreurs: ValidationIssue[];
  avertissements: ValidationIssue[];
  informations: ValidationIssue[];
  necessiteVerificationHumaine: boolean;
  emissionAutomatiqueAutorisee: boolean;
}

export interface ValidateProfilCandidatInput {
  profil: ProfilCandidatInput;
  bacAccelereEligibilityAnswers?: EligibilityAnswers;
}

// ── helpers ──

function push(list: ValidationIssue[], issue: ValidationIssue): void {
  list.push(issue);
}

const NOTE_MIN = 0;
const NOTE_MAX = 20;

function validateSession(policy: ExamPolicy, profil: ProfilCandidatInput, erreurs: ValidationIssue[]): boolean {
  if (!getSupportedSessions().includes(profil.examSession)) {
    push(erreurs, {
      code: 'SESSION_NON_SUPPORTEE',
      severity: 'ERROR',
      field: 'examSession',
      messageFamille: "La session indiquée n'est pas prise en charge par le référentiel actuel.",
      messageInterne: `examSession=${profil.examSession} absente de getSupportedSessions()=${getSupportedSessions().join(',')}`,
      blockingForAutomaticQuote: true,
    });
    return false;
  }
  const status = getSessionStatus(profil.examSession);
  if (status !== 'ACTIVE') {
    push(erreurs, {
      code: 'SESSION_NON_COMMERCIALISABLE',
      severity: 'ERROR',
      field: 'examSession',
      messageFamille: 'Cette session ne peut pas faire l\'objet d\'un nouveau devis.',
      messageInterne: `session ${profil.examSession} status=${status}`,
      blockingForAutomaticQuote: true,
    });
    return false;
  }
  return true;
}

/**
 * Surfaces all 3 outcomes of checkSameSessionEligibility (lib/exams/catalog.ts,
 * single point of truth — never re-derived here), not just the uncertain one.
 * ELIGIBLE and NOT_ELIGIBLE_STANDARD_TWO_SESSION_PATH are informational (P3
 * simply isn't the applicable parcours, exactly like any other non-matching
 * P1-P12 candidate fact) — only ELIGIBILITY_REQUIRES_HUMAN_REVIEW blocks.
 */
function validateP3(
  policy: ExamPolicy,
  input: ValidateProfilCandidatInput,
  avertissements: ValidationIssue[],
  informations: ValidationIssue[],
): void {
  if (!input.bacAccelereEligibilityAnswers) return;
  const eligibility = checkSameSessionEligibility(policy, input.bacAccelereEligibilityAnswers);
  if (eligibility.outcome === 'ELIGIBILITY_REQUIRES_HUMAN_REVIEW') {
    push(avertissements, {
      code: 'P3_ELIGIBILITE_INDETERMINEE',
      severity: 'WARNING',
      field: 'bacAccelereEligibilityAnswers',
      messageFamille:
        "Votre éligibilité au bac en un an dépend d'une confirmation de l'académie — nous ne pouvons pas la garantir automatiquement.",
      messageInterne: eligibility.reason,
      blockingForAutomaticQuote: true,
    });
  } else if (eligibility.outcome === 'ELIGIBLE') {
    push(informations, {
      code: 'P3_ELIGIBLE_CONFIRMEE',
      severity: 'INFO',
      field: 'bacAccelereEligibilityAnswers',
      messageFamille: 'Votre éligibilité au bac en un an (même session) est confirmée.',
      messageInterne: `matchedConditionIds=${eligibility.matchedConditionIds.join(',')}`,
      blockingForAutomaticQuote: false,
    });
  } else {
    push(informations, {
      code: 'P3_NON_ELIGIBLE',
      severity: 'INFO',
      field: 'bacAccelereEligibilityAnswers',
      messageFamille: "Aucune condition de dérogation ne s'applique — parcours standard sur deux sessions.",
      blockingForAutomaticQuote: false,
    });
  }
}

function validateP11P12(profil: ProfilCandidatInput, avertissements: ValidationIssue[], informations: ValidationIssue[]): void {
  if (profil.moyenneRattrapage != null && (profil.moyenneRattrapage < 8 || profil.moyenneRattrapage > 10)) {
    push(informations, {
      code: 'P11_MOYENNE_HORS_PLAGE',
      severity: 'INFO',
      field: 'moyenneRattrapage',
      messageFamille: 'La moyenne indiquée ne relève pas du second groupe (rattrapage).',
      messageInterne: `moyenneRattrapage=${profil.moyenneRattrapage} hors [8,10]`,
      blockingForAutomaticQuote: false,
    });
  }
  if (profil.etalementPlurisessionsDeclare) {
    push(avertissements, {
      code: 'P12_VALIDATION_HUMAINE_OBLIGATOIRE',
      severity: 'WARNING',
      field: 'etalementPlurisessionsDeclare',
      messageFamille: "L'étalement sur plusieurs sessions nécessite systématiquement une validation par notre équipe.",
      blockingForAutomaticQuote: true,
    });
  }
}

function validateModalite(policy: ExamPolicy, profil: ProfilCandidatInput, avertissements: ValidationIssue[]): void {
  if (profil.modalite !== 'B') return;
  for (const id of ['histoire-geographie', 'lva', 'lvb', 'emc']) {
    const ep = getEpreuve(policy, id);
    if (!ep?.coefficientParModalite) continue;
    if (typeof ep.coefficientParModalite.B === 'string') {
      push(avertissements, {
        code: 'MODALITE_B_COEFFICIENT_A_VERIFIER',
        severity: 'WARNING',
        field: id,
        messageFamille: `Le coefficient de ${ep.label} en modalité B n'est pas encore confirmé par les textes officiels.`,
        messageInterne: `${id}: coefficientParModalite.B = À_VERIFIER`,
        blockingForAutomaticQuote: true,
      });
    }
  }
}

export const KNOWN_SUBJECTS = new Set([
  ...KNOWN_SPECIALITIES,
  ...LANGUAGE_CODES,
  'MATHS_EXPERTES',
  'FRANCAIS',
  'PHILOSOPHIE',
  'HISTOIRE_GEO',
]);

function validateSpecialites(profil: ProfilCandidatInput, erreurs: ValidationIssue[]): void {
  for (const issue of validateSpecialityFields(profil)) {
    push(erreurs, {
      code: issue.code,
      severity: 'ERROR',
      field: issue.field,
      messageFamille: issue.message,
      messageInterne: `${issue.field} absent de KNOWN_SPECIALITIES`,
      blockingForAutomaticQuote: true,
    });
  }
  if (profil.specialite1 === profil.specialite2) {
    push(erreurs, {
      code: 'SPECIALITES_DOUBLON',
      severity: 'ERROR',
      field: 'specialite2',
      messageFamille: 'Les deux spécialités indiquées sont identiques.',
      blockingForAutomaticQuote: true,
    });
  }
  if (profil.specialiteAbandonnee) {
    if (profil.specialiteAbandonnee === profil.specialite1 || profil.specialiteAbandonnee === profil.specialite2) {
      push(erreurs, {
        code: 'SPECIALITE_ABANDONNEE_INCOHERENTE',
        severity: 'ERROR',
        field: 'specialiteAbandonnee',
        messageFamille: 'La spécialité abandonnée ne peut pas être identique à une spécialité conservée.',
        blockingForAutomaticQuote: true,
      });
    }
  }

  // Cohérence P9 (changementSpecialite) <-> specialiteAbandonnee : le
  // modificateur P9 (lib/exams/parcours.ts) n'a de sens que s'il désigne
  // sans ambiguïté la spécialité abandonnée, et réciproquement une
  // spécialité abandonnée déclarée sans P9 est une incohérence de saisie
  // (mission Lot 4 correctif §1 — "détermination univoque du complément").
  if (profil.changementSpecialite && !profil.specialiteAbandonnee) {
    push(erreurs, {
      code: 'SPECIALITE_ABANDONNEE_MANQUANTE_POUR_P9',
      severity: 'ERROR',
      field: 'specialiteAbandonnee',
      messageFamille: 'Un changement de spécialité a été signalé, mais la spécialité abandonnée en Première n\'est pas identifiée.',
      blockingForAutomaticQuote: true,
    });
  }
  if (!profil.changementSpecialite && profil.specialiteAbandonnee) {
    push(erreurs, {
      code: 'SPECIALITE_ABANDONNEE_SANS_P9',
      severity: 'ERROR',
      field: 'changementSpecialite',
      messageFamille: 'Une spécialité abandonnée est déclarée sans que le changement de spécialité (P9) le soit.',
      blockingForAutomaticQuote: true,
    });
  }
}

function validateLangues(profil: ProfilCandidatInput, erreurs: ValidationIssue[]): void {
  const validation = validateLanguagePair(profil.langueA, profil.langueB);
  for (const issue of validation.issues) {
    push(erreurs, {
      code: issue.code,
      severity: 'ERROR',
      field: issue.field,
      messageFamille: issue.message,
      blockingForAutomaticQuote: true,
    });
  }
}

/**
 * Never re-derives exclusion/prerequisite/count rules — delegates entirely
 * to lib/exams/options.ts (the single canonical source, cf.
 * __tests__/lib/exams/options-exclusion.test.ts) and propagates its exact
 * error codes unchanged, instead of collapsing them into a generic
 * OPTION_INVALIDE (mission Lot 4 correctif §1/§2 — each invariant must
 * stay individually identifiable, never duplicated).
 */
function validateOptions(
  profil: ProfilCandidatInput,
  erreurs: ValidationIssue[],
  avertissements: ValidationIssue[],
  informations: ValidationIssue[],
): void {
  if (profil.optionsTerminale.length === 0) return;
  const normalized = profil.optionsTerminale.map(normalizeOptionCode);
  const validation = validateOptionsSelection({
    optionsTerminale: normalized,
    specialitesTerminale: [profil.specialite1, profil.specialite2],
  });
  for (const err of validation.erreurs) {
    push(erreurs, {
      code: err.code,
      severity: 'ERROR',
      field: 'optionsTerminale',
      messageFamille: err.message,
      blockingForAutomaticQuote: true,
    });
  }
  for (const code of normalized) {
    if (isLcaOption(code)) {
      push(informations, {
        code: 'OPTION_LCA_TRAITEMENT_DISTINCT',
        severity: 'INFO',
        field: code,
        messageFamille: `${code} (Langues et cultures de l'Antiquité) ne compte pas dans le plafond des options terminale.`,
        blockingForAutomaticQuote: false,
      });
    }
    push(avertissements, {
      code: 'OPTION_COEFFICIENT_NON_SOURCE',
      severity: 'WARNING',
      field: code,
      messageFamille: `Le coefficient de l'option ${code} n'est pas encore disponible dans notre référentiel.`,
      blockingForAutomaticQuote: true,
    });
  }
}

function conservedNoteSource(policy: ExamPolicy): RegulatorySource | undefined {
  const rules = policy.candidatIndividuelRules;
  if (typeof rules === 'string') return undefined;
  return policy.sources.find((s) => s.label === 'Conservation des notes du baccalauréat');
}

function reconductionAutomatiqueSource(policy: ExamPolicy): RegulatorySource | undefined {
  return policy.sources.find((s) => s.label.startsWith('Reconduction automatique des résultats'));
}

function validateNotesConservees(
  policy: ExamPolicy,
  profil: ProfilCandidatInput,
  erreurs: ValidationIssue[],
  avertissements: ValidationIssue[],
  informations: ValidationIssue[],
): void {
  const entries = profil.notesConservees ?? [];
  const seen = new Set<string>();
  const rules = policy.candidatIndividuelRules;
  const noteConservation = typeof rules === 'string' ? null : rules.noteConservation;

  for (const entry of entries) {
    if (seen.has(entry.epreuveId)) {
      push(erreurs, {
        code: 'NOTE_DOUBLE_STATUT',
        severity: 'ERROR',
        field: 'notesConservees',
        messageFamille: `Plusieurs déclarations trouvées pour la même épreuve (${entry.epreuveId}).`,
        blockingForAutomaticQuote: true,
      });
    }
    seen.add(entry.epreuveId);

    if (!Number.isFinite(entry.note) || entry.note < NOTE_MIN || entry.note > NOTE_MAX) {
      push(erreurs, {
        code: 'NOTE_HORS_BAREME',
        severity: 'ERROR',
        field: 'notesConservees',
        messageFamille: `La note déclarée pour ${entry.epreuveId} est hors barème (0-20).`,
        blockingForAutomaticQuote: true,
      });
    }

    if (!getEpreuve(policy, entry.epreuveId)) {
      push(erreurs, {
        code: 'NOTE_EPREUVE_INCONNUE',
        severity: 'ERROR',
        field: 'notesConservees',
        messageFamille: `L'épreuve "${entry.epreuveId}" n'est pas reconnue pour cette session.`,
        blockingForAutomaticQuote: true,
      });
    }

    if (entry.sessionObtention >= policy.session) {
      // Same or future session — can never be a "prior" note, checked first
      // and independently of the registry (arithmetic, not a data lookup).
      push(erreurs, {
        code: 'NOTE_SESSION_ORIGINE_INVALIDE',
        severity: 'ERROR',
        field: 'notesConservees',
        messageFamille: `La session d'obtention déclarée pour ${entry.epreuveId} n'est pas valide.`,
        messageInterne: `sessionObtention=${entry.sessionObtention}, session cible=${policy.session}`,
        blockingForAutomaticQuote: true,
      });
    } else if (noteConservation && policy.session - entry.sessionObtention > noteConservation.validSessions) {
      // Checked BEFORE the registry-membership check below: a note old
      // enough to exceed the conservation window is "too old" regardless
      // of whether we still hold that old session's exam-policy JSON — the
      // registry only keeps a few recent sessions, so requiring
      // getSupportedSessions() membership first would make this branch
      // unreachable for genuinely old notes.
      push(erreurs, {
        code: 'NOTE_DELAI_MAXIMAL_DEPASSE',
        severity: 'ERROR',
        field: 'notesConservees',
        messageFamille: `Le délai de conservation (${noteConservation.validSessions} sessions) est dépassé pour ${entry.epreuveId}.`,
        source: conservedNoteSource(policy),
        blockingForAutomaticQuote: true,
      });
    } else if (!getSupportedSessions().includes(entry.sessionObtention)) {
      push(erreurs, {
        code: 'NOTE_SESSION_ORIGINE_INVALIDE',
        severity: 'ERROR',
        field: 'notesConservees',
        messageFamille: `La session d'obtention déclarée pour ${entry.epreuveId} n'est pas valide.`,
        messageInterne: `sessionObtention=${entry.sessionObtention} absente de getSupportedSessions()`,
        blockingForAutomaticQuote: true,
      });
    }

    if (noteConservation && entry.mecanisme === 'CONSERVATION_DEMANDEE' && entry.note < noteConservation.thresholdOutOf20) {
      push(informations, {
        code: 'NOTE_SEUIL_NON_ATTEINT',
        severity: 'INFO',
        field: 'notesConservees',
        messageFamille: `La note déclarée pour ${entry.epreuveId} est sous le seuil de conservation — l'épreuve devra être représentée.`,
        blockingForAutomaticQuote: false,
      });
    }

    if (entry.mecanisme === 'INDETERMINE') {
      push(avertissements, {
        code: 'NOTE_MECANISME_INDETERMINE',
        severity: 'WARNING',
        field: 'notesConservees',
        messageFamille: `Le mécanisme applicable à la note de ${entry.epreuveId} (conservation ou reconduction) reste à déterminer.`,
        blockingForAutomaticQuote: true,
      });
    }

    if (entry.mecanisme === 'RECONDUCTION_AUTOMATIQUE_CONFIRMEE' && !profil.estRedoublant) {
      push(erreurs, {
        code: 'NOTE_RECONDUCTION_SANS_REDOUBLEMENT',
        severity: 'ERROR',
        field: 'notesConservees',
        messageFamille: `Une reconduction automatique a été déclarée pour ${entry.epreuveId} sans situation de redoublement.`,
        messageInterne: 'Article D. 334-7-1 ne s\'applique qu\'en cas de redoublement de terminale.',
        blockingForAutomaticQuote: true,
      });
    }

    if (entry.mecanisme === 'RECONDUCTION_AUTOMATIQUE_CONFIRMEE' && entry.reconductionAudit?.statutVerification !== 'VERIFIEE') {
      push(avertissements, {
        code: 'NOTE_RECONDUCTION_NON_VERIFIEE',
        severity: 'WARNING',
        field: 'notesConservees',
        messageFamille: `La reconduction automatique déclarée pour ${entry.epreuveId} n'a pas encore été vérifiée par un membre du personnel.`,
        messageInterne: 'ADR-dette-reconduction-p3-gates.md Gate 1 — mecanisme seul ne suffit jamais, reconductionAudit.statutVerification doit être VERIFIEE.',
        source: reconductionAutomatiqueSource(policy),
        blockingForAutomaticQuote: true,
      });
    }

    if (getEpreuve(policy, entry.epreuveId) && getSupportedSessions().includes(entry.sessionObtention)) {
      const resolution = resolveConservedNoteCoefficient({
        epreuveId: entry.epreuveId,
        sessionObtention: entry.sessionObtention,
        sessionRepresentation: policy.session,
      });
      if (resolution.outcome === 'COEFFICIENT_REQUIRES_HUMAN_REVIEW') {
        push(avertissements, {
          code: 'NOTE_DIVERGENCE_COEFFICIENT',
          severity: 'WARNING',
          field: 'notesConservees',
          messageFamille: `Le coefficient de ${entry.epreuveId} a changé entre la session d'origine et la session cible — une confirmation est nécessaire.`,
          messageInterne: resolution.reason,
          blockingForAutomaticQuote: true,
        });
      }
    }
  }

  if (entries.some((e) => e.mecanisme === 'CONSERVATION_DEMANDEE')) {
    push(informations, {
      code: 'NOTE_PERTE_MENTION',
      severity: 'INFO',
      field: 'notesConservees',
      messageFamille: 'La conservation de notes demandée exclut l\'attribution d\'une mention pour cette session.',
      source: conservedNoteSource(policy),
      blockingForAutomaticQuote: false,
    });
  }
}

function validateDispenses(
  policy: ExamPolicy,
  profil: ProfilCandidatInput,
  erreurs: ValidationIssue[],
  avertissements: ValidationIssue[],
): void {
  const seen = new Set<string>();
  for (const dispense of profil.dispensesDeclarees ?? []) {
    if (seen.has(dispense.epreuveId)) {
      push(erreurs, {
        code: 'DISPENSE_DOUBLE_STATUT',
        severity: 'ERROR',
        field: 'dispensesDeclarees',
        messageFamille: `Plusieurs déclarations trouvées pour la même dispense (${dispense.epreuveId}).`,
        blockingForAutomaticQuote: true,
      });
    }
    seen.add(dispense.epreuveId);

    if (!getEpreuve(policy, dispense.epreuveId)) {
      push(erreurs, {
        code: 'DISPENSE_EPREUVE_INCONNUE',
        severity: 'ERROR',
        field: 'dispensesDeclarees',
        messageFamille: `L'épreuve "${dispense.epreuveId}" n'est pas reconnue pour une dispense.`,
        blockingForAutomaticQuote: true,
      });
    }

    if (!profil.estTitulaireBacDejaObtenu) {
      push(avertissements, {
        code: 'DISPENSE_HORS_CONTEXTE_P7',
        severity: 'WARNING',
        field: 'dispensesDeclarees',
        messageFamille: 'Une dispense a été déclarée alors que le profil ne correspond pas à un candidat déjà titulaire du bac.',
        blockingForAutomaticQuote: false,
      });
    }

    if (dispense.statut === 'DECLAREE') {
      push(avertissements, {
        code: 'DISPENSE_DECLAREE_NON_CONFIRMEE',
        severity: 'WARNING',
        field: 'dispensesDeclarees',
        messageFamille: `La dispense pour ${dispense.epreuveId} est déclarée mais pas encore confirmée.`,
        blockingForAutomaticQuote: true,
      });
    }

    if (dispense.statut === 'CONFIRMEE' && !dispense.justificatifRef) {
      push(erreurs, {
        code: 'DISPENSE_CONFIRMEE_SANS_JUSTIFICATIF',
        severity: 'ERROR',
        field: 'dispensesDeclarees',
        messageFamille: `La confirmation de dispense pour ${dispense.epreuveId} nécessite une référence de justificatif.`,
        blockingForAutomaticQuote: true,
      });
    }
  }
}

function validateCoherenceGlobale(
  policy: ExamPolicy,
  input: ValidateProfilCandidatInput,
  erreurs: ValidationIssue[],
  informations: ValidationIssue[],
): void {
  const { profil } = input;

  if (profil.estTitulaireBacDejaObtenu && profil.level === 'PREMIERE') {
    push(erreurs, {
      code: 'INFORMATIONS_CONTRADICTOIRES',
      severity: 'ERROR',
      field: 'level',
      messageFamille: 'Un candidat déjà titulaire du baccalauréat ne peut pas être positionné en Première.',
      blockingForAutomaticQuote: true,
    });
  }

  const resolution = resolveParcoursType(policy, {
    profil,
    bacAccelereEligibilityAnswers: input.bacAccelereEligibilityAnswers,
  });
  if (resolution.faitsConcurrents.length > 0) {
    push(informations, {
      code: 'FAITS_CONCURRENTS_PRESENTS',
      severity: 'INFO',
      messageFamille: 'Plusieurs situations particulières ont été détectées sur ce profil — la principale a été retenue, les autres restent visibles pour information.',
      messageInterne: `principal=${resolution.parcoursPrincipal}; concurrents=${resolution.faitsConcurrents.map((f) => f.parcours).join(',')}`,
      blockingForAutomaticQuote: false,
    });
  }
}

export function validateProfilCandidat(policy: ExamPolicy, input: ValidateProfilCandidatInput): ProfileValidationResult {
  const { profil } = input;
  const erreurs: ValidationIssue[] = [];
  const avertissements: ValidationIssue[] = [];
  const informations: ValidationIssue[] = [];

  const sessionOk = validateSession(policy, profil, erreurs);
  if (sessionOk) {
    validateP3(policy, input, avertissements, informations);
    validateP11P12(profil, avertissements, informations);
    validateModalite(policy, profil, avertissements);
    validateSpecialites(profil, erreurs);
    validateLangues(profil, erreurs);
    validateOptions(profil, erreurs, avertissements, informations);
    validateNotesConservees(policy, profil, erreurs, avertissements, informations);
    validateDispenses(policy, profil, erreurs, avertissements);
    validateCoherenceGlobale(policy, input, erreurs, informations);
  }

  // Défense en profondeur : un ValidationIssue mal classé (ex. une ERROR
  // poussée par erreur dans avertissements) romprait silencieusement le
  // contrat valide/necessiteVerificationHumaine/emissionAutomatiqueAutorisee
  // — mission Lot 4 correctif §5. Échoue bruyamment plutôt que de laisser
  // passer une classification incohérente.
  assertConsistentSeverities(erreurs, 'ERROR');
  assertConsistentSeverities(avertissements, 'WARNING');
  assertConsistentSeverities(informations, 'INFO');

  const blockingIssues = [...erreurs, ...avertissements].filter((i) => i.blockingForAutomaticQuote);
  const necessiteVerificationHumaine = blockingIssues.length > 0;

  return {
    valide: erreurs.length === 0,
    erreurs,
    avertissements,
    informations,
    necessiteVerificationHumaine,
    emissionAutomatiqueAutorisee: erreurs.length === 0 && !necessiteVerificationHumaine,
  };
}

function assertConsistentSeverities(list: ValidationIssue[], expected: ValidationSeverity): void {
  const offender = list.find((i) => i.severity !== expected);
  if (offender) {
    throw new Error(
      `validateProfilCandidat: issue "${offender.code}" a severity=${offender.severity} mais figure dans la liste ${expected} — classification interne incohérente, corriger le validateur avant émission.`,
    );
  }
}
