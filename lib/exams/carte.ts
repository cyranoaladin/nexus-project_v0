/**
 * genererCarteExamen — the central regulatory deliverable (mission §3.2):
 * a pure function turning a ProfilCandidat + session policy into the
 * exhaustive, épreuve-by-épreuve exam card. Never saisie manuellement.
 *
 * Consumes only what Lot 1 already built (lib/exams/catalog.ts) and Lot 3's
 * resolveParcoursType — no regulatory fact is re-derived or hardcoded here.
 */
import 'server-only';
import {
  getEpreuve,
  hasPracticalPartDispensation,
  isMentionEligible,
  resolveConservedNoteCoefficient,
} from './catalog';
import { A_VERIFIER, isAVerifier, type AVerifiable } from './a-verifier';
import { normalizeOptionCode, validateOptionsSelection } from './options';
import { resolveParcoursType, type ProfilCandidatInput, type ParcoursResolution } from './parcours';
import type { ExamPolicy } from './schema';

export type EpreuveStatut = 'A_PRESENTER' | 'CONSERVEE' | 'DISPENSEE' | 'RECONDUITE';
export type EpreuveNature = 'ANTICIPEE' | 'TERMINALE' | 'PONCTUELLE' | 'OPTION';

export interface EpreuveCarte {
  code: string;
  libelle: string;
  matiere: string;
  nature: EpreuveNature;
  anneePassation: number | null;
  coefficientEffectif: AVerifiable<number>;
  statut: EpreuveStatut;
  sourceReglementaire: string;
  avertissements: string[];
  necessiteVerificationHumaine: boolean;
}

export interface CarteExamenResult {
  parcours: ParcoursResolution;
  epreuves: EpreuveCarte[];
  totalCoefficientObligatoire: AVerifiable<number>;
  totalCoefficientOptions: AVerifiable<number>;
  necessiteVerificationHumaine: boolean;
  avertissementsGeneraux: string[];
  /** false whenever any part of the card is uncertain or the parcours is manual-assisted (P12) — mission §3.3. */
  emissionAutomatiqueAutorisee: boolean;
}

export interface GenererCarteExamenInput {
  profil: ProfilCandidatInput;
  policy: ExamPolicy;
  bacAccelereEligibilityAnswers?: Parameters<typeof resolveParcoursType>[1]['bacAccelereEligibilityAnswers'];
}

const SUBJECT_LABELS: Record<string, string> = {
  MATHEMATIQUES: 'Mathématiques',
  MATHS_EXPERTES: 'Mathématiques expertes',
  NSI: 'NSI',
  FRANCAIS: 'Français',
  PHILOSOPHIE: 'Philosophie',
  HISTOIRE_GEO: 'Histoire-Géographie',
  ANGLAIS: 'Anglais',
  ESPAGNOL: 'Espagnol',
  PHYSIQUE_CHIMIE: 'Physique-Chimie',
  SVT: 'SVT',
  SES: 'SES',
};

function subjectLabel(code: string): string {
  return SUBJECT_LABELS[code] ?? code;
}

function epreuveSource(policy: ExamPolicy): string {
  return `Référentiel session ${policy.session} (lib/exams, ${policy.sources[0]?.label ?? 'sources versionnées'})`;
}

/** Anticipées are sat once, in première, never re-sat at the terminale stage — structural, not discretionary conservation (distinct from CONSERVEE's D. 334-13 opt-in mechanism). */
function buildAnticipeeLine(policy: ExamPolicy, epreuveId: string, presentedThisSession: boolean): EpreuveCarte {
  const ep = getEpreuve(policy, epreuveId);
  if (!ep) throw new Error(`Épreuve anticipée "${epreuveId}" introuvable pour la session ${policy.session}.`);
  return {
    code: ep.id,
    libelle: ep.label,
    matiere: ep.label,
    nature: 'ANTICIPEE',
    anneePassation: presentedThisSession ? policy.session : null,
    coefficientEffectif: ep.coefficient,
    statut: presentedThisSession ? 'A_PRESENTER' : 'RECONDUITE',
    sourceReglementaire: epreuveSource(policy),
    avertissements: [],
    necessiteVerificationHumaine: false,
  };
}

function resolveTerminaleLine(
  policy: ExamPolicy,
  epreuveId: string,
  libelle: string,
  matiere: string,
  conserved: ProfilCandidatInput['notesConservees'],
): EpreuveCarte {
  const ep = getEpreuve(policy, epreuveId);
  if (!ep) throw new Error(`Épreuve "${epreuveId}" introuvable pour la session ${policy.session}.`);
  const conservedEntry = conserved?.find((n) => n.epreuveId === epreuveId);

  if (conservedEntry) {
    const resolution = resolveConservedNoteCoefficient({
      epreuveId,
      sessionObtention: conservedEntry.sessionObtention,
      sessionRepresentation: policy.session,
    });
    return {
      code: ep.id,
      libelle,
      matiere,
      nature: 'TERMINALE',
      anneePassation: conservedEntry.sessionObtention,
      coefficientEffectif: resolution.outcome === 'RESOLVED' ? resolution.coefficient : A_VERIFIER,
      statut: 'CONSERVEE',
      sourceReglementaire: epreuveSource(policy),
      avertissements: resolution.outcome === 'COEFFICIENT_REQUIRES_HUMAN_REVIEW' ? [resolution.reason] : [],
      necessiteVerificationHumaine: resolution.outcome === 'COEFFICIENT_REQUIRES_HUMAN_REVIEW',
    };
  }

  return {
    code: ep.id,
    libelle,
    matiere,
    nature: 'TERMINALE',
    anneePassation: policy.session,
    coefficientEffectif: ep.coefficient,
    statut: 'A_PRESENTER',
    sourceReglementaire: epreuveSource(policy),
    avertissements: [],
    necessiteVerificationHumaine: false,
  };
}

function resolvePonctuelleLine(policy: ExamPolicy, epreuveId: string, modalite: 'A' | 'B'): EpreuveCarte {
  const ep = getEpreuve(policy, epreuveId);
  if (!ep) throw new Error(`Épreuve ponctuelle "${epreuveId}" introuvable pour la session ${policy.session}.`);

  let coefficientEffectif: AVerifiable<number> = ep.coefficient;
  const avertissements: string[] = [];
  let necessiteVerificationHumaine = false;

  if (ep.coefficientParModalite) {
    if (modalite === 'A') {
      coefficientEffectif = ep.coefficientParModalite.A;
    } else if (isAVerifier(ep.coefficientParModalite.B)) {
      coefficientEffectif = A_VERIFIER;
      necessiteVerificationHumaine = true;
      avertissements.push(
        `Coefficient modalité B pour ${ep.label} non confirmé par note de service — À_VERIFIER, ne pas généraliser depuis une autre matière.`,
      );
    } else {
      // Modalité B splits première/terminale — this session's terminale share.
      coefficientEffectif = ep.coefficientParModalite.B.terminale;
    }
  }

  return {
    code: ep.id,
    libelle: ep.label,
    matiere: ep.label,
    nature: 'PONCTUELLE',
    anneePassation: policy.session,
    coefficientEffectif,
    statut: 'A_PRESENTER',
    sourceReglementaire: epreuveSource(policy),
    avertissements,
    necessiteVerificationHumaine,
  };
}

export function genererCarteExamen(input: GenererCarteExamenInput): CarteExamenResult {
  const { profil, policy } = input;
  const parcours = resolveParcoursType(policy, {
    profil,
    bacAccelereEligibilityAnswers: input.bacAccelereEligibilityAnswers,
  });

  const epreuves: EpreuveCarte[] = [];
  const avertissementsGeneraux: string[] = [];

  // ── Anticipées (EAF écrit/oral, EAM) — structurally reconduites at terminale level ──
  const presentedThisSession = profil.level === 'PREMIERE';
  for (const id of ['eaf-ecrit', 'eaf-oral', 'eam']) {
    if (getEpreuve(policy, id)) {
      epreuves.push(buildAnticipeeLine(policy, id, presentedThisSession));
    }
  }

  // A PREMIERE-level candidate presenting only anticipées this session has
  // nothing else on the card yet — the rest is next session's concern.
  if (profil.level === 'PREMIERE') {
    return finalizeCarte(parcours, epreuves, avertissementsGeneraux);
  }

  // ── Terminale core: EDS1/EDS2 (labelled from the profile's actual specialités), philosophie, Grand Oral ──
  epreuves.push(
    resolveTerminaleLine(policy, 'eds1', subjectLabel(profil.specialite1), subjectLabel(profil.specialite1), profil.notesConservees),
  );
  epreuves.push(
    resolveTerminaleLine(policy, 'eds2', subjectLabel(profil.specialite2), subjectLabel(profil.specialite2), profil.notesConservees),
  );
  epreuves.push(resolveTerminaleLine(policy, 'philosophie', 'Philosophie', 'Philosophie', profil.notesConservees));
  epreuves.push(resolveTerminaleLine(policy, 'grand-oral', 'Grand Oral', 'Grand Oral', profil.notesConservees));

  for (const specialite of [profil.specialite1, profil.specialite2]) {
    if (hasPracticalPartDispensation(policy, specialite)) {
      const line = epreuves.find((e) => e.matiere === subjectLabel(specialite) && e.nature === 'TERMINALE');
      line?.avertissements.push(
        `${subjectLabel(specialite)} : dispensé de partie pratique pour le candidat individuel (note sur le seul écrit).`,
      );
    }
  }

  // ── Spécialité abandonnée (ponctuelle) — only when declared ──
  if (profil.specialiteAbandonnee) {
    epreuves.push(
      resolveTerminaleAsPonctuelle(policy, 'specialite-abandonnee', subjectLabel(profil.specialiteAbandonnee)),
    );
  }

  // ── Tronc commun ponctuel: HG, LVA, LVB, enseignement scientifique, EMC ──
  for (const id of ['histoire-geographie', 'lva', 'lvb', 'enseignement-scientifique', 'emc']) {
    if (getEpreuve(policy, id)) {
      epreuves.push(resolvePonctuelleLine(policy, id, profil.modalite));
    }
  }

  // ── EPS — hors modalité A/B, épreuve ponctuelle terminale unique ──
  if (getEpreuve(policy, 'eps')) {
    epreuves.push(resolvePonctuelleLine(policy, 'eps', profil.modalite));
  }

  // ── Options ──
  if (profil.optionsTerminale.length > 0) {
    const normalized = profil.optionsTerminale.map(normalizeOptionCode);
    const validation = validateOptionsSelection({
      optionsTerminale: normalized,
      specialitesTerminale: [profil.specialite1, profil.specialite2],
    });
    if (!validation.valide) {
      for (const erreur of validation.erreurs) {
        avertissementsGeneraux.push(`Options invalides (${erreur.code}) : ${erreur.message}`);
      }
    }
    for (const code of normalized) {
      epreuves.push({
        code,
        libelle: code,
        matiere: code,
        nature: 'OPTION',
        anneePassation: policy.session,
        coefficientEffectif: A_VERIFIER,
        statut: 'A_PRESENTER',
        sourceReglementaire:
          'Coefficient non sourcé dans le référentiel Lot 1 — options structurelles (lib/exams/options.ts), pas de valeur chiffrée disponible.',
        avertissements: ['Coefficient non sourcé — À_VERIFIER, exclu du total obligatoire.'],
        necessiteVerificationHumaine: true,
      });
    }
  }

  // ── Perte de mention (conservation demandée) ──
  const hasConservation = (profil.notesConservees?.length ?? 0) > 0;
  if (hasConservation && !isMentionEligible(policy, { hasRequestedNoteConservation: true })) {
    avertissementsGeneraux.push(
      "Conservation de note demandée : aucune mention ne peut être attribuée pour cette session (articles D. 334-13 et D. 336-13).",
    );
  }

  return finalizeCarte(parcours, epreuves, avertissementsGeneraux);
}

function resolveTerminaleAsPonctuelle(policy: ExamPolicy, epreuveId: string, matiere: string): EpreuveCarte {
  const ep = getEpreuve(policy, epreuveId);
  if (!ep) throw new Error(`Épreuve "${epreuveId}" introuvable pour la session ${policy.session}.`);
  return {
    code: ep.id,
    libelle: `${ep.label} — ${matiere}`,
    matiere,
    nature: 'PONCTUELLE',
    anneePassation: policy.session,
    coefficientEffectif: ep.coefficient,
    statut: 'A_PRESENTER',
    sourceReglementaire: epreuveSource(policy),
    avertissements: [],
    necessiteVerificationHumaine: false,
  };
}

function finalizeCarte(
  parcours: ParcoursResolution,
  epreuves: EpreuveCarte[],
  avertissementsGeneraux: string[],
): CarteExamenResult {
  const obligatoires = epreuves.filter((e) => e.nature !== 'OPTION');
  const options = epreuves.filter((e) => e.nature === 'OPTION');

  const anyObligatoireUncertain = obligatoires.some((e) => isAVerifier(e.coefficientEffectif));
  const totalCoefficientObligatoire: AVerifiable<number> = anyObligatoireUncertain
    ? A_VERIFIER
    : obligatoires.reduce((sum, e) => sum + (e.coefficientEffectif as number), 0);

  const anyOptionUncertain = options.some((e) => isAVerifier(e.coefficientEffectif));
  const totalCoefficientOptions: AVerifiable<number> = anyOptionUncertain
    ? A_VERIFIER
    : options.reduce((sum, e) => sum + (e.coefficientEffectif as number), 0);

  const necessiteVerificationHumaine =
    parcours.requiresHumanReview ||
    epreuves.some((e) => e.necessiteVerificationHumaine) ||
    avertissementsGeneraux.some((a) => /invalides/i.test(a));

  return {
    parcours,
    epreuves,
    totalCoefficientObligatoire,
    totalCoefficientOptions,
    necessiteVerificationHumaine,
    avertissementsGeneraux,
    emissionAutomatiqueAutorisee: !necessiteVerificationHumaine && parcours.parcours !== 'P12_ETALEMENT_PLURISESSIONS',
  };
}
