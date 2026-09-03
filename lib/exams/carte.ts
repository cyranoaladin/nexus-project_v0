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
import { A_VERIFIER, isAVerifier, requireResolved, type AVerifiable } from './a-verifier';
import { isLanguageCode, LANGUAGE_LABELS } from './languages';
import { normalizeOptionCode, validateOptionsSelection } from './options';
import { resolveParcoursType, type ProfilCandidatInput, type ParcoursResolution, type ConservedNoteInput } from './parcours';
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
  /**
   * Stable, machine-checkable codes explaining every reason
   * necessiteVerificationHumaine=true — mission "vers un produit complet"
   * §3 (P3 commercial-coverage closure). Callers (assistante UI, tests,
   * a future family UI) must branch on these codes, never on substring
   * matches against avertissementsGeneraux's free text, which can be
   * reworded without notice. Empty when necessiteVerificationHumaine is
   * false.
   */
  blockingReasonCodes: string[];
}

/**
 * P3 (bac accéléré, article 3 — same-session dérogation) commercial-
 * coverage gate (mission "vers un produit complet" §3, closure lot).
 *
 * Distinct from P3's LEGAL eligibility gate (p3EligibiliteAudit ->
 * resolveParcoursType's requiresHumanReview, ADR-dette-reconduction-p3-
 * gates.md Gate 2): that gate answers "is this candidate legally allowed
 * to sit P3 at all", and can resolve to false (fully confirmed) while
 * this — a SEPARATE, COMMERCIAL question — remains completely open. The
 * previous version of this file conflated the two ("P3's existing
 * eligibility review already owns the blocking gate" — it does not, for
 * this question): a fully eligible P3 candidate could still reach
 * emissionAutomatiqueAutorisee=true with a standard, non-compressed-pace
 * volume of hours, silently under-provisioned. Confirmed unresolved by
 * reading lib/quotes/priority.ts and lib/quotes/pricing.ts in full (see
 * the comment further below): nothing in this repository today derives a
 * larger volume, a dedicated module, or a validated protocol for P3's
 * compressed pace — SVC_TUTORAT_COMPRESSION was retired specifically
 * because no such service was ever defined. Until a real, sourced
 * mechanism exists, this gate is unconditional for every P3 profile —
 * never bypassable by an eligibility confirmation, a catalogue change, or
 * a direct API call (the gate lives in the pure carte-generation function
 * every caller already goes through, not in a route-level check that a
 * new entry point could forget).
 */
export const P3_COMPRESSION_NON_COUVERTE_CODE = 'P3_ACCOMPAGNEMENT_ACCELERE_A_DIMENSIONNER';

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
  ...LANGUAGE_LABELS,
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

/**
 * A declared conserved note only actually triggers CONSERVEE when it clears
 * the D. 334-13 threshold (≥10/20) — a note below the threshold, or an
 * invalid one, must be represented (A_PRESENTER), never silently treated as
 * conserved. Never enforced before this review — a declared note of any
 * value was previously accepted as CONSERVEE unconditionally.
 */
function checkConservationApplies(policy: ExamPolicy, note: number): { ok: true } | { ok: false; reason: string } {
  if (!Number.isFinite(note) || note < 0 || note > 20) {
    return {
      ok: false,
      reason: `Note déclarée invalide (${note}) — hors barème 0-20 ; déclaration à corriger avant émission, épreuve traitée comme à présenter dans l'intervalle.`,
    };
  }
  const rules = requireResolved(policy.candidatIndividuelRules, `session ${policy.session} candidatIndividuelRules`);
  const { thresholdOutOf20 } = rules.noteConservation;
  if (note < thresholdOutOf20) {
    return {
      ok: false,
      reason: `Note déclarée (${note}/20) inférieure au seuil de conservation (${thresholdOutOf20}/20, article D. 334-13) — l'épreuve doit être représentée, la conservation ne s'applique pas.`,
    };
  }
  return { ok: true };
}

interface ConservedLineFields {
  anneePassation: number | null;
  coefficientEffectif: AVerifiable<number>;
  statut: EpreuveStatut;
  avertissements: string[];
  necessiteVerificationHumaine: boolean;
}

function resolveCoefficientCarryOver(policy: ExamPolicy, epreuveId: string, sessionObtention: number) {
  return resolveConservedNoteCoefficient({ epreuveId, sessionObtention, sessionRepresentation: policy.session });
}

/**
 * Shared by anticipées and terminale-core lines. Branches on
 * conservedEntry.mecanisme (mission Lot 4 §4) — conservation sur demande
 * (D. 334-13) and reconduction automatique confirmée (D. 334-7-1) are
 * legally distinct: different threshold, different mention consequence,
 * different resulting statut. Never conflated.
 */
function resolveConservedLine(
  policy: ExamPolicy,
  epreuveId: string,
  conservedEntry: ConservedNoteInput,
): ConservedLineFields {
  if (conservedEntry.mecanisme === 'INDETERMINE') {
    return {
      anneePassation: conservedEntry.sessionObtention,
      coefficientEffectif: A_VERIFIER,
      statut: 'RECONDUITE',
      avertissements: [
        `Note connue pour ${epreuveId} (session ${conservedEntry.sessionObtention}) mais le mécanisme applicable — conservation sur demande (article D. 334-13) ou reconduction automatique (article D. 334-7-1) — n'a pas été déterminé. À trancher explicitement avant émission, jamais deviné.`,
      ],
      necessiteVerificationHumaine: true,
    };
  }

  if (conservedEntry.mecanisme === 'RECONDUCTION_AUTOMATIQUE_CONFIRMEE') {
    // ADR-dette-reconduction-p3-gates.md Gate 1: mecanisme alone is never
    // enough — the audit trail must show a staff member actually verified
    // it (statutVerification === 'VERIFIEE'). Anything else (missing audit,
    // NON_VERIFIEE, REFUSEE) fails closed exactly like INDETERMINE — a
    // caller cannot bypass this by setting mecanisme directly without the
    // corresponding audit record.
    if (conservedEntry.reconductionAudit?.statutVerification !== 'VERIFIEE') {
      return {
        anneePassation: conservedEntry.sessionObtention,
        coefficientEffectif: A_VERIFIER,
        statut: 'RECONDUITE',
        avertissements: [
          `Reconduction automatique déclarée pour ${epreuveId} (article D. 334-7-1) mais non vérifiée par un membre du personnel (statutVerification="${conservedEntry.reconductionAudit?.statutVerification ?? 'absent'}") — jamais confirmée à partir d'une simple déclaration. Revue humaine requise avant émission.`,
        ],
        necessiteVerificationHumaine: true,
      };
    }
    // D. 334-7-1: no 10/20 floor, no mention forfeiture — those are D. 334-13-specific.
    const resolution = resolveCoefficientCarryOver(policy, epreuveId, conservedEntry.sessionObtention);
    return {
      anneePassation: conservedEntry.sessionObtention,
      coefficientEffectif: resolution.outcome === 'RESOLVED' ? resolution.coefficient : A_VERIFIER,
      statut: 'RECONDUITE',
      avertissements: resolution.outcome === 'COEFFICIENT_REQUIRES_HUMAN_REVIEW' ? [resolution.reason] : [],
      necessiteVerificationHumaine: resolution.outcome === 'COEFFICIENT_REQUIRES_HUMAN_REVIEW',
    };
  }

  // CONSERVATION_DEMANDEE — article D. 334-13, threshold + mention forfeiture apply.
  const applicability = checkConservationApplies(policy, conservedEntry.note);
  if (!applicability.ok) {
    const ep = getEpreuve(policy, epreuveId);
    return {
      anneePassation: policy.session,
      coefficientEffectif: ep?.coefficient ?? A_VERIFIER,
      statut: 'A_PRESENTER',
      avertissements: [applicability.reason],
      necessiteVerificationHumaine: false,
    };
  }

  const resolution = resolveCoefficientCarryOver(policy, epreuveId, conservedEntry.sessionObtention);
  return {
    anneePassation: conservedEntry.sessionObtention,
    coefficientEffectif: resolution.outcome === 'RESOLVED' ? resolution.coefficient : A_VERIFIER,
    statut: 'CONSERVEE',
    avertissements: resolution.outcome === 'COEFFICIENT_REQUIRES_HUMAN_REVIEW' ? [resolution.reason] : [],
    necessiteVerificationHumaine: resolution.outcome === 'COEFFICIENT_REQUIRES_HUMAN_REVIEW',
  };
}

/**
 * Anticipées status — CORRECTED after regulatory research (2026-08-25),
 * replacing a prior blanket "never re-sat at terminale" heuristic that was
 * an unsourced absolute (flagged as such in review). What's actually
 * confirmed:
 *
 * - Redoublement de PREMIÈRE: anticipées must be RE-PRESENTED. Source:
 *   direct citation, "Les candidats redoublant la classe de première
 *   doivent de nouveau présenter les épreuves anticipées. Aucune note de
 *   contrôle continu ne pourra être conservée." → A_PRESENTER, confirmed.
 * - Conservation sur demande (Article D. 334-13 du code de l'éducation,
 *   décret n°2022-143 du 8 février 2022, en vigueur depuis le 10/02/2022 —
 *   https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000037212390 —
 *   étendu aux candidats individuels à compter de la session 2024, source
 *   secondaire non re-vérifiée directement) applies when the candidate
 *   explicitly declares the note in notesConservees, exactly like any
 *   other épreuve → CONSERVEE, same coefficient-resolution path.
 * - Article D. 334-7-1 (décret n°2022-143, applicable depuis la session
 *   2022) provides an AUTOMATIC carry-over of the previous année's results
 *   for a candidate repeating terminale "en cas de redoublement de la
 *   classe terminale OU d'interruption de la scolarité après un échec à
 *   l'examen" — but only "de la session précédant l'échec", i.e. an
 *   immediate, consecutive repeat. ProfilCandidat does not currently
 *   capture whether a redoublement is immediate/consecutive (vs. a gap of
 *   several sessions, a 3rd+ candidacy, or a distinct renunciation) — so
 *   this can NEVER be safely auto-applied from estRedoublant alone. Fails
 *   closed to human review instead of guessing.
 * - A primo-candidat (not redoublant, not bascule) presenting terminale
 *   content the session after their own première leg of the SAME
 *   continuous 2-year journey (P1/P2/P3/P7/P10 without estRedoublant or
 *   brancheBascule) has no D. 334-7-1 ambiguity at all — this is simply
 *   "the anticipées already happened last year in this same cycle",
 *   structurally certain (D. 334-5 ties anticipées to the première
 *   curriculum, sat once). Safe to resolve as RECONDUITE with a firm
 *   coefficient.
 * - Bascule scolaire→individuel (P8, brancheBascule set): the Lot 1
 *   declarative branches (conservation/renonciation des moyennes de
 *   première) describe the évaluations ponctuelles regime, not anticipées
 *   specifically — no source found tying them to EAF/EAM. Fails closed.
 */
function buildAnticipeeLine(
  policy: ExamPolicy,
  epreuveId: string,
  profil: Pick<ProfilCandidatInput, 'level' | 'estRedoublant' | 'brancheBascule' | 'notesConservees'>,
  forcePresentedThisSession: boolean,
): EpreuveCarte {
  const ep = getEpreuve(policy, epreuveId);
  if (!ep) throw new Error(`Épreuve anticipée "${epreuveId}" introuvable pour la session ${policy.session}.`);

  const base = {
    code: ep.id,
    libelle: ep.label,
    matiere: ep.label,
    nature: 'ANTICIPEE' as const,
    sourceReglementaire: epreuveSource(policy),
  };

  // P3 (bac accéléré, même session) or a Première-level candidate: nothing
  // was ever sat in a prior année to reason about, present now.
  if (profil.level === 'PREMIERE' || forcePresentedThisSession) {
    return {
      ...base,
      anneePassation: policy.session,
      coefficientEffectif: ep.coefficient,
      statut: 'A_PRESENTER',
      avertissements: [],
      necessiteVerificationHumaine: false,
    };
  }

  const conservedEntry = profil.notesConservees?.find((n) => n.epreuveId === epreuveId);
  if (conservedEntry) {
    return { ...base, ...resolveConservedLine(policy, epreuveId, conservedEntry) };
  }

  if (profil.estRedoublant || profil.brancheBascule != null) {
    return {
      ...base,
      anneePassation: null,
      coefficientEffectif: A_VERIFIER,
      statut: 'RECONDUITE',
      avertissements: [
        `${ep.label} : une reconduction automatique peut s'appliquer (article D. 334-7-1 du code de l'éducation, uniquement en cas de redoublement immédiat consécutif à un échec) mais le profil ne permet pas de confirmer que cette condition est réunie (absence de lacune entre sessions, session d'échec immédiatement précédente). À vérifier auprès du Bureau des examens avant émission — ne pas deviner. Si le candidat souhaite conserver cette note sur demande explicite, la déclarer dans notesConservees (article D. 334-13).`,
      ],
      necessiteVerificationHumaine: true,
    };
  }

  // Primo-candidat continu, sans redoublement ni bascule : l'anticipée a eu
  // lieu l'an dernier dans le même cursus — aucune ambiguïté D. 334-7-1.
  return {
    ...base,
    anneePassation: policy.session - 1,
    coefficientEffectif: ep.coefficient,
    statut: 'RECONDUITE',
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
    return {
      code: ep.id,
      libelle,
      matiere,
      nature: 'TERMINALE',
      sourceReglementaire: epreuveSource(policy),
      ...resolveConservedLine(policy, epreuveId, conservedEntry),
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

  // P3 (bac accéléré, article 3) presents anticipées AND terminale content
  // in the same session — there is no prior année to reason about, so the
  // usual redoublant/bascule fail-closed branches don't apply here. The
  // card still shows this informationally even when eligibility isn't yet
  // confirmed (requiresHumanReview) — the overall emission gate already
  // comes from parcours.requiresHumanReview via finalizeCarte.
  const isBacAccelere = parcours.parcoursPrincipal === 'P3_LIBRE_1AN_DEROGATION';

  // Honesty finding (mission "vers un produit complet" §3): a P3 candidate
  // covers, in a single session, content normally spread over two years —
  // but lib/quotes/priority.ts::scoreSubjects only lets monthsRemaining
  // affect subject PRIORITY ORDER (urgencyFactor), never the actual
  // hours/month volume returned by lib/quotes/pricing.ts::volumeForSubject.
  // Nothing today automatically raises volume or flags the compressed
  // pace for a P3 profile — confirmed by reading both functions, not
  // assumed. Retiring SVC_TUTORAT_COMPRESSION (docs/candidat-individuel/
  // resolution-tutorat-compression.md) removed an undefined line item; it
  // must never be read as "P3's compressed-pace need is covered". This
  // warning makes that gap visible on every P3 carte rather than letting
  // a standard-pace scenario look adequate by omission — informational
  // (avertissementsGeneraux), not a new blocking gate; P3's existing
  // eligibility review (p3EligibiliteAudit) already owns the blocking gate.
  const blockingReasonCodes: string[] = [];
  if (isBacAccelere) {
    avertissementsGeneraux.push(
      "Parcours P3 (dérogation même session, article 3 de l'arrêté du 16 juillet 2018) : le candidat couvre en une session le contenu normalement réparti sur deux années. Le moteur ne majore pas automatiquement le volume horaire recommandé pour ce rythme compressé — un accompagnement renforcé (volume horaire augmenté et/ou suivi individualisé) doit être arbitré explicitement avec la famille, jamais présenté comme une préparation à rythme standard.",
    );
    // Mission "vers un produit complet" §3 (lot de fermeture P11/P3) —
    // this is a SEPARATE, COMMERCIAL question from P3's legal eligibility
    // gate (parcours.requiresHumanReview, above) and must never be
    // considered satisfied by it. Unconditional: no service, volume, or
    // protocol anywhere in this repository covers the compression today
    // (SVC_TUTORAT_COMPRESSION was retired specifically because none was
    // ever defined) — until one exists and can be checked here explicitly,
    // every P3 profile requires human review, with no exception.
    blockingReasonCodes.push(P3_COMPRESSION_NON_COUVERTE_CODE);
  }

  // ── Anticipées (EAF écrit/oral, EAM) — see buildAnticipeeLine for the full, sourced decision tree ──
  for (const id of ['eaf-ecrit', 'eaf-oral', 'eam']) {
    if (getEpreuve(policy, id)) {
      epreuves.push(buildAnticipeeLine(policy, id, profil, isBacAccelere));
    }
  }

  // T5R — RECETTE_FINDING_2 fix: the PREMIERE-level early `return` used
  // to skip straight to finalizeCarte(), which also skipped the
  // dispensesDeclarees loop entirely (it lived further down, after the
  // terminale-content block) — a declared dispense on a PREMIERE profil
  // was silently never applied, neither rejected nor accepted, simply
  // never reached. Replaced by a plain `if` guarding only the
  // terminale-only content (EDS1/EDS2/philosophie/Grand Oral/spécialité
  // abandonnée/tronc commun ponctuel/EPS — genuinely irrelevant to a
  // PREMIERE-level candidate this session, unchanged) so execution now
  // always reaches the single dispensesDeclarees loop below, whatever
  // épreuves ended up on the card for this profil's level. No new
  // dispense kind, no new regulatory rule, no change to the three-state
  // semantics (DECLAREE/CONFIRMEE/REFUSEE, mission Lot 4 §3) — a dispense
  // for an épreuve genuinely not on the card (terminale content on a
  // PREMIERE profil, or any unknown code) still correctly falls into the
  // "aucune épreuve correspondante trouvée" branch.
  if (!(profil.level === 'PREMIERE' && !isBacAccelere)) {
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
        const line = resolvePonctuelleLine(policy, id, profil.modalite);
        const language = id === 'lva' ? profil.langueA : id === 'lvb' ? profil.langueB : null;
        if (isLanguageCode(language)) {
          const languageLabel = LANGUAGE_LABELS[language];
          line.matiere = languageLabel;
          line.libelle = `${line.libelle} — ${languageLabel}`;
        }
        epreuves.push(line);
      }
    }

    // ── EPS — hors modalité A/B, épreuve ponctuelle terminale unique ──
    if (getEpreuve(policy, 'eps')) {
      epreuves.push(resolvePonctuelleLine(policy, 'eps', profil.modalite));
    }
  }

  // ── Dispenses déclarées (P7, titulaire du bac) — trois états distincts
  // (mission Lot 4 §3), jamais un DISPENSEE définitif à partir d'une
  // simple déclaration :
  //   DECLAREE  -> DISPENSEE, mais necessiteVerificationHumaine=true (pas encore validée)
  //   CONFIRMEE -> DISPENSEE, définitif (un humain a vérifié le justificatif)
  //   REFUSEE   -> reste A_PRESENTER, avertissement informatif (déclaration écartée)
  //
  // Runs once, uniformly, for every profil level — reaches whatever
  // épreuves ended up on the card above (anticipées only for PREMIERE;
  // anticipées + full terminale content for TERMINALE/P3).
  for (const dispense of profil.dispensesDeclarees ?? []) {
    const line = epreuves.find((e) => e.code === dispense.epreuveId && e.nature !== 'OPTION');
    if (!line) {
      avertissementsGeneraux.push(
        `Dispense déclarée pour "${dispense.epreuveId}" : aucune épreuve correspondante trouvée sur cette carte — déclaration à vérifier (code inconnu ou épreuve non applicable à ce profil).`,
      );
      continue;
    }
    if (dispense.statut === 'REFUSEE') {
      line.avertissements.push(
        `Dispense déclarée pour ${line.matiere} examinée puis écartée — l'épreuve reste à présenter.`,
      );
      continue;
    }
    line.statut = 'DISPENSEE';
    line.necessiteVerificationHumaine = dispense.statut !== 'CONFIRMEE';
    line.avertissements.push(
      dispense.statut === 'CONFIRMEE'
        ? `Dispense confirmée pour ${line.matiere} (arrêté du 14 mai 2020) — vérifiée par un humain contre justificatif.`
        : `Dispense DÉCLARÉE par le candidat pour ${line.matiere} (arrêté du 14 mai 2020), pas encore une dispense réglementaire validée — Nexus ne peut pas vérifier la déclaration elle-même. Revue humaine requise avant émission ; modifie le périmètre facturable si confirmée.`,
    );
  }

  // A PREMIERE-level candidate presenting only anticipées this session has
  // nothing else on the card yet — the rest is next session's concern.
  // Exception: P3 always needs the full terminale content too, regardless
  // of the level currently on file. Options/perte de mention below remain
  // terminale-only concerns (unchanged) — a PREMIERE profil finalizes here.
  if (profil.level === 'PREMIERE' && !isBacAccelere) {
    return finalizeCarte(parcours, epreuves, avertissementsGeneraux, blockingReasonCodes);
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
  // Mention forfeiture (D. 334-13) is specific to a REQUESTED conservation
  // — a confirmed reconduction (D. 334-7-1) or an indeterminate note fact
  // must never trigger it.
  const hasConservation = (profil.notesConservees ?? []).some((n) => n.mecanisme === 'CONSERVATION_DEMANDEE');
  if (hasConservation && !isMentionEligible(policy, { hasRequestedNoteConservation: true })) {
    avertissementsGeneraux.push(
      "Conservation de note demandée : aucune mention ne peut être attribuée pour cette session (articles D. 334-13 et D. 336-13).",
    );
  }

  return finalizeCarte(parcours, epreuves, avertissementsGeneraux, blockingReasonCodes);
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
  blockingReasonCodes: string[] = [],
): CarteExamenResult {
  const allObligatoires = epreuves.filter((e) => e.nature !== 'OPTION');
  const options = epreuves.filter((e) => e.nature === 'OPTION');

  // A DISPENSEE line still flagged for human review (declared, not yet
  // confirmed) keeps the whole total uncertain — whether its coefficient
  // will end up counting isn't decided yet. A CONFIRMEE dispense (DISPENSEE
  // + necessiteVerificationHumaine=false) is definitively excluded from the
  // sum instead, since the épreuve genuinely no longer counts.
  const anyObligatoireUncertain = allObligatoires.some(
    (e) => isAVerifier(e.coefficientEffectif) || (e.statut === 'DISPENSEE' && e.necessiteVerificationHumaine),
  );
  const obligatoiresComptabilises = allObligatoires.filter(
    (e) => !(e.statut === 'DISPENSEE' && !e.necessiteVerificationHumaine),
  );
  const totalCoefficientObligatoire: AVerifiable<number> = anyObligatoireUncertain
    ? A_VERIFIER
    : obligatoiresComptabilises.reduce((sum, e) => sum + (e.coefficientEffectif as number), 0);

  const anyOptionUncertain = options.some((e) => isAVerifier(e.coefficientEffectif));
  const totalCoefficientOptions: AVerifiable<number> = anyOptionUncertain
    ? A_VERIFIER
    : options.reduce((sum, e) => sum + (e.coefficientEffectif as number), 0);

  const necessiteVerificationHumaine =
    parcours.requiresHumanReview ||
    epreuves.some((e) => e.necessiteVerificationHumaine) ||
    avertissementsGeneraux.some((a) => /invalides/i.test(a)) ||
    blockingReasonCodes.length > 0;

  return {
    parcours,
    epreuves,
    totalCoefficientObligatoire,
    totalCoefficientOptions,
    necessiteVerificationHumaine,
    avertissementsGeneraux,
    emissionAutomatiqueAutorisee: !necessiteVerificationHumaine && parcours.parcoursPrincipal !== 'P12_ETALEMENT_PLURISESSIONS',
    blockingReasonCodes,
  };
}
