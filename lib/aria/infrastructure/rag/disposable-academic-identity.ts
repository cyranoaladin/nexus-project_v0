import { createHmac } from 'node:crypto';
import type { AriaResolvedRagStudentIdentity } from '../../rag';

type JsonRecord = Readonly<Record<string, unknown>>;

function record(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function string(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function isDisposableAriaRagIdentityConfigured(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return environment.E2E_DISPOSABLE_STACK === '1'
    && Buffer.byteLength(environment.NEXUS_INTERNAL_TOKEN_SECRET ?? '', 'utf8') >= 32
    && Boolean(environment.ARIA_E2E_RAG_CANDIDAT)
    && Boolean(environment.ARIA_E2E_RAG_AUDIENCE)
    && Boolean(environment.ARIA_E2E_RAG_ZONE)
    && Boolean(environment.ARIA_E2E_RAG_STATUS_DETAIL);
}

export function resolveDisposableAriaRagIdentity(input: {
  readonly context: {
    readonly courseKey: string;
    readonly subject: { readonly studentId: string };
  };
  readonly plan: {
    readonly courseKey: string;
    readonly retrievalScope: Readonly<Record<string, unknown>>;
  };
  readonly environment?: Readonly<Record<string, string | undefined>>;
}): AriaResolvedRagStudentIdentity | null {
  const environment = input.environment ?? process.env;
  if (!isDisposableAriaRagIdentityConfigured(environment)
    || input.context.courseKey !== input.plan.courseKey) return null;
  const signingKey = environment.NEXUS_INTERNAL_TOKEN_SECRET ?? '';
  const candidat = environment.ARIA_E2E_RAG_CANDIDAT ?? '';
  const audience = environment.ARIA_E2E_RAG_AUDIENCE ?? '';
  const zone = environment.ARIA_E2E_RAG_ZONE ?? '';
  const statusDetail = environment.ARIA_E2E_RAG_STATUS_DETAIL ?? '';
  if (Buffer.byteLength(signingKey, 'utf8') < 32
    || !candidat || !audience || !zone || !statusDetail) return null;

  const target = record(input.plan.retrievalScope.target_policy);
  const evidence = record(input.plan.retrievalScope.evidence_subject);
  const candidates = target?.candidates;
  const audiences = target?.audiences;
  if (!target || !evidence
    || !Array.isArray(candidates) || !candidates.includes(candidat)
    || !Array.isArray(audiences) || !audiences.includes(audience)) return null;

  const niveau = string(target.niveau);
  const voie = string(target.voie);
  const matiere = string(target.matiere);
  const statutEnseignement = string(target.statut_enseignement);
  const schoolYear = string(evidence.school_year);
  if (!niveau || !voie || !matiere || !statutEnseignement || !schoolYear
    || evidence.niveau !== niveau || evidence.voie !== voie
    || evidence.matiere !== matiere || evidence.statut_enseignement !== statutEnseignement) {
    return null;
  }

  const pseudonym = createHmac('sha256', signingKey)
    .update(`aria-e2e-student:${input.context.subject.studentId}`, 'utf8')
    .digest('hex')
    .slice(0, 32);
  return Object.freeze({
    pseudonymousSubject: `psn_${pseudonym}`,
    niveau,
    voie,
    matiere,
    statutEnseignement,
    candidat,
    audience,
    schoolYear,
    zone,
    statusDetail,
  });
}
