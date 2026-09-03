/**
 * Canonical Quote Context Adapter (Track A, Section 1/7/11).
 *
 * The ONLY bridge between ProfilCandidat's P1-P12 eligibility engine
 * (lib/exams/*) and the existing, canonical quote engine (lib/quotes/*:
 * buildRecommendation, createQuote, pdf-adapter, margin.server.ts). This
 * module computes nothing of its own — no price, no margin, no payment
 * schedule. It only:
 *   1. derives the SituationInput the existing engine already accepts
 *      from a ProfilCandidat (lowercase level, [specialite1, specialite2]
 *      tuple — the two types diverge in shape, this is the single place
 *      that translates between them);
 *   2. runs the P1-P12 validation + carte-génération pipeline and
 *      packages the result (for Quote.snapshotCarte/snapshotRegles/
 *      parcours/regulatoryMaturity) using emission-gate.ts's single
 *      AND-composition point — never re-deriving that boolean itself.
 *
 * A second pricing/quote/margin engine must never grow out of this file —
 * if a future change needs to compute money here, that is a sign the
 * change belongs in lib/quotes/pricing.ts or margin.server.ts instead.
 */
import 'server-only';
import type { Subject } from '@prisma/client';
import { requireExamPolicy } from '@/lib/exams/catalog';
import { canEmitAutomatically } from '@/lib/exams/emission-gate';
import { genererCarteExamen, type CarteExamenResult } from '@/lib/exams/carte';
import { deriveEligibilityAnswersFromAudit, type ProfilCandidatInput } from '@/lib/exams/parcours';
import { validateProfilCandidat, type ProfileValidationResult } from '@/lib/exams/profile-validation';
import type { CandidateLevel, SituationInput } from './schemas';

export interface CanonicalCandidateQuoteContext {
  /** Feeds the EXISTING lib/quotes/* pipeline (buildRecommendation, etc.) unchanged. */
  situation: SituationInput;
  validation: ProfileValidationResult;
  carte: CarteExamenResult;
  /** emission-gate.ts's canEmitAutomatically(validation, carte) — the single AND, never re-derived here. */
  emissionAutomatiqueAutorisee: boolean;
  /** Quote.regulatoryMaturity's source of truth: CARTE_VALIDATED_DEFINITIVE only when automatic emission is authorized end-to-end. */
  regulatoryMaturity: 'LEGACY_ESTIMATE_UNVERIFIED' | 'CARTE_VALIDATED_DEFINITIVE';
}

const LEVEL_TO_SITUATION: Record<ProfilCandidatInput['level'], CandidateLevel> = {
  PREMIERE: 'premiere',
  TERMINALE: 'terminale',
};

function toSituationInput(profil: ProfilCandidatInput): SituationInput {
  // ProfilCandidatInput deliberately types these as bare `string` (a
  // Prisma-independent mirror, lib/exams/parcours.ts) while SituationInput
  // uses the real Prisma Subject enum. The cast is safe here: every
  // ProfilCandidat row is written through Prisma (Subject-typed columns)
  // or through normalize.ts's normalizeSpeciality/normalizeLanguage
  // (which only ever resolve to a real Subject value) — this adapter
  // boundary is the one place that bridges the two type systems, never a
  // silent assumption elsewhere.
  return {
    level: LEVEL_TO_SITUATION[profil.level],
    examSession: profil.examSession,
    specialites: [profil.specialite1 as Subject, profil.specialite2 as Subject],
    specialiteAbandonnee: (profil.specialiteAbandonnee as Subject | null) ?? undefined,
    langueA: (profil.langueA as Subject | null) ?? undefined,
    langueB: (profil.langueB as Subject | null) ?? undefined,
  };
}

export function buildCandidateQuoteContext(profil: ProfilCandidatInput, examSession: number): CanonicalCandidateQuoteContext {
  const policy = requireExamPolicy(examSession);
  const bacAccelereEligibilityAnswers = deriveEligibilityAnswersFromAudit(profil.p3EligibiliteAudit);

  const validation = validateProfilCandidat(policy, { profil, bacAccelereEligibilityAnswers });
  const carte = genererCarteExamen({ profil, policy, bacAccelereEligibilityAnswers });
  const emissionAutomatiqueAutorisee = canEmitAutomatically(validation, carte);

  return {
    situation: toSituationInput(profil),
    validation,
    carte,
    emissionAutomatiqueAutorisee,
    regulatoryMaturity: emissionAutomatiqueAutorisee ? 'CARTE_VALIDATED_DEFINITIVE' : 'LEGACY_ESTIMATE_UNVERIFIED',
  };
}
