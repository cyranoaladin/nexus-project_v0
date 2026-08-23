/**
 * Thin, stable projection of a candidate's diagnostic into per-subject
 * tiers the priority engine can consume. Does NOT recompute or duplicate
 * scoring — it only buckets percentages that lib/diagnostics/candidat-libre
 * already computed (CDC §41). Pure, no DB.
 */
import { createHash } from 'node:crypto';
import type { Subject } from '@prisma/client';
import type { DiagnosticSubjectProjection, DiagnosticTier, SituationInput, SubjectId } from './schemas';

/**
 * Tier thresholds — a documented, centralized business decision (not
 * scattered magic numbers). Adjustable in one place; every threshold is
 * covered by a test in __tests__/lib/quotes/diagnostic.test.ts.
 */
export const DIAGNOSTIC_TIER_THRESHOLDS = {
  SOLIDE: 75,
  A_CONSOLIDER: 50,
  A_INSTALLER: 30,
} as const;

export function percentageToTier(percentage: number | null): DiagnosticTier {
  if (percentage == null) return 'NON_EVALUE';
  if (percentage >= DIAGNOSTIC_TIER_THRESHOLDS.SOLIDE) return 'SOLIDE';
  if (percentage >= DIAGNOSTIC_TIER_THRESHOLDS.A_CONSOLIDER) return 'A_CONSOLIDER';
  if (percentage >= DIAGNOSTIC_TIER_THRESHOLDS.A_INSTALLER) return 'A_INSTALLER';
  return 'A_RECTIFIER';
}

/** The diagnostic's raw per-domain scores — matches DiagnosticAutoScore.domainScores. */
export type RawDomainScores = Record<string, { points: number; maxPoints: number; percentage: number | null }>;

/**
 * Fixed subjects whose diagnostic domain doesn't depend on which
 * specialty the candidate chose (unlike EDS/spécialité abandonnée/LVA/LVB).
 * Each subject can aggregate several finer diagnostic domains (e.g.
 * "francais" spans francais_academique/production_ecrite/langue/
 * expression_orale) — the projection takes the average of whichever of
 * those domains have real data, ignoring the rest, rather than penalizing
 * a subject for domains it doesn't actually cover.
 */
const FIXED_SUBJECT_DOMAINS: Partial<Record<SubjectId, string[]>> = {
  francais: ['francais_academique', 'production_ecrite', 'langue', 'expression_orale'],
  'maths-anticipees': ['mathematiques', 'preuves'],
  philosophie: ['philosophie'],
  'grand-oral': ['grand_oral'],
  'histoire-geographie': ['histoire_geo'],
  'enseignement-scientifique': ['enseignement_scientifique'],
};

/**
 * Specialty-dependent subjects (EDS1/EDS2/spécialité abandonnée/LVA/LVB) map
 * to a diagnostic domain only for the subjects the diagnostic tool actually
 * covers today. Anything else (Physique-Chimie, SVT, Maths expertes,
 * Espagnol, ...) has no diagnostic domain and correctly resolves to
 * NON_EVALUE rather than a guessed score.
 */
const PRISMA_SUBJECT_TO_DOMAIN: Partial<Record<Subject, string>> = {
  MATHEMATIQUES: 'mathematiques',
  NSI: 'nsi',
  SES: 'ses',
  ANGLAIS: 'anglais',
};

function averagePercentage(domainKeys: string[], raw: RawDomainScores): number | null {
  const values = domainKeys
    .map((key) => raw[key])
    .filter((d): d is RawDomainScores[string] => d != null && d.percentage != null)
    .map((d) => d.percentage as number);
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

export interface DiagnosticSubjectResult {
  subject: SubjectId;
  tier: DiagnosticTier;
  percentage: number | null;
  overconfident: boolean;
}

/**
 * Projects raw diagnostic domain scores onto the subjects relevant to a
 * candidate's situation (per lib/quotes/exam-profile.ts). Subjects the
 * diagnostic tool has no data for resolve to NON_EVALUE — never a guess.
 */
export function projectDiagnostic(
  situation: SituationInput,
  raw: RawDomainScores,
  overconfidentDomainKeys: Set<string> = new Set(),
): DiagnosticSubjectResult[] {
  const results: DiagnosticSubjectResult[] = [];

  const pushFixed = (subject: SubjectId) => {
    const domains = FIXED_SUBJECT_DOMAINS[subject];
    if (!domains) return;
    const percentage = averagePercentage(domains, raw);
    results.push({
      subject,
      tier: percentageToTier(percentage),
      percentage,
      overconfident: domains.some((d) => overconfidentDomainKeys.has(d)),
    });
  };

  const pushBySubjectEnum = (subject: SubjectId, prismaSubject: Subject | undefined) => {
    const domain = prismaSubject ? PRISMA_SUBJECT_TO_DOMAIN[prismaSubject] : undefined;
    const percentage = domain ? averagePercentage([domain], raw) : null;
    results.push({
      subject,
      tier: percentageToTier(percentage),
      percentage,
      overconfident: domain != null && overconfidentDomainKeys.has(domain),
    });
  };

  if (situation.level === 'premiere') {
    pushFixed('francais');
    pushFixed('maths-anticipees');
    return results;
  }

  pushBySubjectEnum('eds1', situation.specialites[0]);
  pushBySubjectEnum('eds2', situation.specialites[1]);
  pushFixed('philosophie');
  pushFixed('grand-oral');
  pushFixed('histoire-geographie');
  pushBySubjectEnum('lva', situation.langueA);
  pushBySubjectEnum('lvb', situation.langueB);
  pushFixed('enseignement-scientifique');
  if (situation.specialiteAbandonnee) {
    pushBySubjectEnum('specialite-abandonnee', situation.specialiteAbandonnee);
  }

  return results;
}

/**
 * Deterministic fingerprint of a diagnostic projection — same canonical
 * key-sorted-JSON + SHA-256 pattern as
 * lib/diagnostics/candidat-libre/item-checksum.ts. Stored on the Quote row
 * so a later diagnostic change never silently reopens an already-quoted
 * recommendation (CDC §24).
 */
export function computeDiagnosticChecksum(subjects: DiagnosticSubjectProjection[]): string {
  const canonical = JSON.stringify(
    [...subjects].sort((a, b) => a.subject.localeCompare(b.subject)),
    (_key, value) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort());
      }
      return value;
    },
  );
  return createHash('sha256').update(canonical).digest('hex');
}
