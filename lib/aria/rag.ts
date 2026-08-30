import { randomUUID } from 'node:crypto';
import type {
  AriaCitationHit,
  AriaCourseKey,
  AriaRagState,
  AriaRetrievalPlan,
} from './contracts';
import type { AriaPedagogicalMode } from './domain/pedagogy/pedagogical-mode';
import { getAriaRagCorpusCapability } from './infrastructure/rag/manifest';
import {
  AriaRagEngineClientError,
  loadAriaRagEngineClientConfig,
  searchAriaRagV2,
  type AriaRagEngineClientConfig,
} from './infrastructure/rag/rag-engine-client';
import {
  createAriaRagInternalIdentityToken,
  loadAriaRagIdentitySignerConfig,
  sha256AriaRagJson,
  type AriaRagIdentitySignerConfig,
} from './infrastructure/rag/internal-identity';
import { ARIA_PERFORMANCE_BUDGETS } from './domain/observability/performance-budgets';

type JsonRecord = Record<string, unknown>;
type SearchAriaRagV2 = typeof searchAriaRagV2;

export interface AriaResolvedRagStudentIdentity {
  readonly pseudonymousSubject: string;
  readonly niveau: string;
  readonly voie: string;
  readonly matiere: string;
  readonly statutEnseignement: string;
  readonly candidat: string;
  readonly audience: string;
  readonly schoolYear: string;
  readonly zone: string;
  readonly statusDetail: string;
}

export function buildAriaRetrievalPlan(
  courseKey: AriaCourseKey,
  pedagogicalMode: AriaPedagogicalMode = 'DISCOVERY',
  agentRole: 'TUTOR' = 'TUTOR',
): AriaRetrievalPlan | null {
  const capability = getAriaRagCorpusCapability(courseKey, pedagogicalMode, agentRole);
  if (capability.status !== 'AVAILABLE') return null;
  return Object.freeze({
    courseKey,
    pedagogicalMode,
    collection: capability.corpus.physicalCollection,
    corpusId: capability.corpus.corpusId,
    corpusVersionId: capability.corpus.corpusVersionId,
    manifestSha256: capability.corpus.manifestSha256,
    resourceRegistrySha256: capability.corpus.resourceRegistrySha256,
    academicYear: capability.corpus.academicYear,
    curriculumVersion: capability.corpus.curriculumVersion,
    retrievalScope: capability.corpus.retrievalScope,
    retrievalScopeSha256: capability.corpus.retrievalScopeSha256,
    resourceBindings: capability.corpus.resourceBindings,
  });
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sameLocator(
  left: Readonly<Record<string, string | number>>,
  right: Readonly<Record<string, string | number>>,
): boolean {
  const leftEntries = Object.entries(left).sort(([a], [b]) => a.localeCompare(b));
  const rightEntries = Object.entries(right).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
}

function locatorToDomain(value: unknown): Readonly<Record<string, string | number>> | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value).filter((entry): entry is [string, string | number] =>
    typeof entry[1] === 'string' || typeof entry[1] === 'number');
  return entries.length > 0 ? Object.freeze(Object.fromEntries(entries)) : null;
}

function validateHitAgainstPlan(plan: AriaRetrievalPlan, hit: JsonRecord): void {
  if (hit.corpus_id !== plan.corpusId
    || hit.corpus_version_id !== plan.corpusVersionId
    || hit.manifest_sha256 !== plan.manifestSha256
    || typeof hit.resource_id !== 'string'
    || typeof hit.resource_version_id !== 'string'
    || typeof hit.content_sha256 !== 'string'
    || typeof hit.chunk_id !== 'string') {
    throw new Error('RAG_PROTOCOL_INVALID');
  }
  const locator = locatorToDomain(hit.locator);
  const resource = plan.resourceBindings.find((binding) =>
    binding.resourceId === hit.resource_id
    && binding.resourceVersionId === hit.resource_version_id
    && binding.contentSha256 === hit.content_sha256);
  const chunk = locator && resource?.chunks.find((binding) =>
    binding.chunkId === hit.chunk_id && sameLocator(binding.locator, locator));
  if (!resource || !chunk) throw new Error('RAG_PROTOCOL_INVALID');
}

function retrievalIntent(mode: AriaPedagogicalMode): string {
  if (mode === 'REVISION') return 'revision';
  if (mode === 'EXAM_SIMULATION') return 'exam_prep';
  if (mode === 'GUIDED_PRACTICE' || mode === 'INDEPENDENT_PRACTICE') return 'exercise';
  if (mode === 'CORRECTION' || mode === 'CHECK_MY_WORK') return 'remediation';
  return 'context';
}

function resolvePlanScope(plan: AriaRetrievalPlan): {
  readonly target: JsonRecord;
  readonly evidence: JsonRecord;
  readonly scopeId: string;
} | null {
  const scope = plan.retrievalScope;
  if (!isRecord(scope.target_policy) || !isRecord(scope.evidence_subject)
    || typeof scope.scope_id !== 'string') return null;
  return { target: scope.target_policy, evidence: scope.evidence_subject, scopeId: scope.scope_id };
}

function identityMatchesPlan(
  identity: AriaResolvedRagStudentIdentity,
  plan: AriaRetrievalPlan,
  target: JsonRecord,
  evidence: JsonRecord,
): boolean {
  return identity.niveau === target.niveau
    && identity.voie === target.voie
    && identity.matiere === target.matiere
    && identity.statutEnseignement === target.statut_enseignement
    && identity.schoolYear === evidence.school_year
    && Array.isArray(target.candidates) && target.candidates.includes(identity.candidat)
    && Array.isArray(target.audiences) && target.audiences.includes(identity.audience)
    && Array.isArray(target.roles) && target.roles.includes('student')
    && evidence.collection === plan.collection;
}

function buildManifestBoundRequest(input: {
  readonly plan: AriaRetrievalPlan;
  readonly query: string;
  readonly identity: AriaResolvedRagStudentIdentity;
  readonly topK: number;
}): { readonly request: JsonRecord; readonly target: JsonRecord; readonly scopeId: string } {
  const scope = resolvePlanScope(input.plan);
  if (!scope || !identityMatchesPlan(input.identity, input.plan, scope.target, scope.evidence)) {
    throw new Error('ACADEMIC_CONTEXT_UNREPRESENTABLE');
  }
  return {
    target: scope.target,
    scopeId: scope.scopeId,
    request: {
      student_profile: {
        availability: {},
        candidat: input.identity.candidat,
        candidate_status_ref: null,
        establishment: null,
        matieres: [input.identity.matiere],
        needs: [],
        nexus_group_id: null,
        nexus_offer: null,
        niveau: input.identity.niveau,
        objective: null,
        official_level_ref: null,
        options: [],
        risk_level: null,
        school_calendar_zone: null,
        school_year: input.identity.schoolYear,
        specialites: [],
        status_detail: input.identity.statusDetail,
        statut_enseignement: input.identity.statutEnseignement,
        student_id: null,
        target_pathway: null,
        teacher_confirmed: false,
        voie: input.identity.voie,
        warnings: [],
        zone: input.identity.zone,
      },
      curriculum_scope: {
        niveau: input.identity.niveau,
        voie: input.identity.voie,
        matiere: input.identity.matiere,
        statut_enseignement: input.identity.statutEnseignement,
      },
      need: {
        desired_doc_types: [],
        difficulty_max: null,
        intent: retrievalIntent(input.plan.pedagogicalMode),
        notions: [],
        query: input.query,
      },
      retrieval: {
        hybrid: true,
        include_citations: true,
        k: input.topK,
        rerank: true,
      },
      manifest_sha256: input.plan.manifestSha256,
      corpus_id: input.plan.corpusId,
      corpus_version_id: input.plan.corpusVersionId,
    },
  };
}

function createManifestBoundToken(input: {
  readonly request: JsonRecord;
  readonly target: JsonRecord;
  readonly scopeId: string;
  readonly plan: AriaRetrievalPlan;
  readonly identity: AriaResolvedRagStudentIdentity;
  readonly signerConfig: AriaRagIdentitySignerConfig;
  readonly now: Date;
  readonly jti: string;
}): string {
  const iat = Math.floor(input.now.getTime() / 1_000);
  const exp = iat + 30;
  const nestedIdentity = {
    aud: input.signerConfig.identityAudience,
    exp,
    iss: input.signerConfig.identityIssuer,
    jti: input.jti,
    tenant: String(input.target.tenant),
    niveau: input.identity.niveau,
    role: 'student',
    school_year: input.identity.schoolYear,
    sub: input.identity.pseudonymousSubject,
    pedagogical_profile: {
      voie: input.identity.voie,
      matieres: [input.identity.matiere],
      statut_enseignement: input.identity.statutEnseignement,
      candidat: input.identity.candidat,
      audience: input.identity.audience,
    },
  };
  return createAriaRagInternalIdentityToken({
    signingKey: input.signerConfig.signingKey,
    envelope: {
      protocol_version: '1',
      iss: input.signerConfig.issuer,
      aud: input.signerConfig.audience,
      sub: input.identity.pseudonymousSubject,
      jti: input.jti,
      iat,
      exp,
      identity: nestedIdentity,
      scope_id: input.scopeId,
      scope_digest: input.plan.retrievalScopeSha256,
      request_sha256: sha256AriaRagJson(input.request),
      manifest_sha256: input.plan.manifestSha256,
      allowed_collections: [input.plan.collection],
    },
  });
}

function responseToCitationHits(plan: AriaRetrievalPlan, response: JsonRecord): readonly AriaCitationHit[] {
  if (!Array.isArray(response.results)) throw new Error('RAG_PROTOCOL_INVALID');
  return Object.freeze(response.results.map((value): AriaCitationHit => {
    if (!isRecord(value) || !isRecord(value.citation)) throw new Error('RAG_PROTOCOL_INVALID');
    validateHitAgainstPlan(plan, value);
    const locator = locatorToDomain(value.locator);
    const citation = value.citation;
    if (!locator || typeof citation.source_label !== 'string'
      || typeof citation.source_uri !== 'string'
      || typeof value.excerpt !== 'string'
      || typeof value.score !== 'number') throw new Error('RAG_PROTOCOL_INVALID');
    return Object.freeze({
      id: String(value.chunk_id),
      sourceTitle: typeof value.title === 'string' ? value.title : citation.source_label,
      sourceDocument: citation.source_uri,
      courseKey: plan.courseKey,
      provenance: citation.source_label,
      ...(citation.source_uri.startsWith('https://') ? { url: citation.source_uri } : {}),
      snippet: value.excerpt,
      score: value.score,
      resourceId: String(value.resource_id),
      resourceVersionId: String(value.resource_version_id),
      contentSha256: String(value.content_sha256),
      chunkId: String(value.chunk_id),
      locator,
      corpusId: String(value.corpus_id),
      corpusVersionId: String(value.corpus_version_id),
      manifestSha256: String(value.manifest_sha256),
    });
  }));
}

export async function executeAriaRetrieval(
  plan: AriaRetrievalPlan | null,
  query: string,
  identity: AriaResolvedRagStudentIdentity | null = null,
  dependencies?: {
    readonly search?: SearchAriaRagV2;
    readonly clientConfig?: AriaRagEngineClientConfig;
    readonly signerConfig?: AriaRagIdentitySignerConfig;
    readonly now?: () => Date;
    readonly createJti?: () => string;
    readonly signal?: AbortSignal;
    readonly k?: number;
  },
): Promise<AriaRagState> {
  if (!plan) return { status: 'NOT_CONFIGURED', reason: 'SERVABLE_CORPUS_NOT_CONFIGURED' };
  if (!query.trim()) return { status: 'NO_RESULTS', plan };
  if (!identity) {
    return { status: 'RUNTIME_UNAVAILABLE', error: 'ACADEMIC_CONTEXT_UNREPRESENTABLE', plan };
  }

  try {
    const topK = dependencies?.k ?? ARIA_PERFORMANCE_BUDGETS.ragTopK;
    if (!Number.isSafeInteger(topK) || topK < 1 || topK > ARIA_PERFORMANCE_BUDGETS.ragTopKMax) {
      throw new Error('RAG_PROTOCOL_INVALID');
    }
    const built = buildManifestBoundRequest({
      plan,
      query: query.trim(),
      identity,
      topK,
    });
    const signerConfig = dependencies?.signerConfig ?? loadAriaRagIdentitySignerConfig();
    const identityToken = createManifestBoundToken({
      ...built,
      plan,
      identity,
      signerConfig,
      now: (dependencies?.now ?? (() => new Date()))(),
      jti: (dependencies?.createJti ?? randomUUID)(),
    });
    const response = await (dependencies?.search ?? searchAriaRagV2)({
      request: built.request,
      identityToken,
      config: dependencies?.clientConfig ?? loadAriaRagEngineClientConfig(),
      signal: dependencies?.signal,
    });
    const hits = responseToCitationHits(plan, response);
    return hits.length === 0
      ? { status: 'NO_RESULTS', plan }
      : { status: 'SUCCESS', hits, plan };
  } catch (error: unknown) {
    if (error instanceof AriaRagEngineClientError) {
      if (error.code === 'NO_RESULTS') return { status: 'NO_RESULTS', plan };
      if (error.code === 'NOT_CONFIGURED') {
        return { status: 'NOT_CONFIGURED', reason: 'RAG_NOT_CONFIGURED' };
      }
      return {
        status: 'RUNTIME_UNAVAILABLE',
        error: error.code === 'TIMEOUT'
          ? 'RAG_TIMEOUT'
          : error.code === 'PROTOCOL_INVALID' || error.code === 'RESPONSE_TOO_LARGE'
            ? 'RAG_PROTOCOL_INVALID'
            : error.code === 'USER_CANCELLED'
              ? 'RAG_USER_CANCELLED'
              : 'RAG_RUNTIME_UNAVAILABLE',
        plan,
      };
    }
    const reason = error instanceof Error && [
      'ACADEMIC_CONTEXT_UNREPRESENTABLE',
      'RAG_PROTOCOL_INVALID',
    ].includes(error.message)
      ? error.message
      : 'RAG_RUNTIME_UNAVAILABLE';
    return { status: 'RUNTIME_UNAVAILABLE', error: reason, plan };
  }
}
