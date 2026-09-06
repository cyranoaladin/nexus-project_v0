import { buildAriaConversationContext } from '@/lib/aria/application/conversation/public';
import type { AriaCitationHit, AriaRagState, AriaRetrievalPlan } from '@/lib/aria/contracts';
import { resolveDisposableAriaRagIdentity } from '@/lib/aria/infrastructure/rag/disposable-academic-identity';
import { resolveProductionAriaRagIdentity } from '@/lib/aria/infrastructure/rag/production-academic-identity';
import {
  executeAriaRetrieval,
  resolveAriaRetrievalPlan,
  type AriaResolvedRagStudentIdentity,
  type AriaRetrievalPlanResolution,
} from '@/lib/aria/rag';

export interface ProgrammeRagV2Hit {
  readonly id: string;
  readonly document: string;
  readonly score: number;
  readonly citation: {
    readonly label: string;
    readonly source: string;
    readonly page: number;
  };
  readonly metadata: {
    readonly title: string;
    readonly source: string;
    readonly sourceLabel: string;
    readonly page: number;
  };
}

export type ProgrammeRagV2Result =
  | {
      readonly status: 'SUCCESS';
      readonly source: 'rag-v2';
      readonly hits: readonly ProgrammeRagV2Hit[];
      readonly context: string;
    }
  | {
      readonly status: 'NO_RESULTS' | 'UNAVAILABLE';
      readonly source: 'none';
      readonly hits: readonly [];
      readonly context: '';
      readonly reason?: string;
    };

interface ProgrammeRagContext {
  readonly courseKey: string;
  readonly subject: { readonly studentId: string };
  readonly student: Parameters<typeof resolveProductionAriaRagIdentity>[0]['context']['student'];
}

interface ProgrammeRagV2Dependencies {
  readonly buildContext: (input: {
    readonly actor: { readonly userId: string; readonly role: string };
    readonly courseKey: string;
  }) => Promise<ProgrammeRagContext>;
  readonly resolvePlan: (
    courseKey: string,
    mode: 'DISCOVERY',
    role: 'TUTOR',
  ) => AriaRetrievalPlanResolution;
  readonly resolveDisposableIdentity: (input: {
    readonly context: ProgrammeRagContext;
    readonly plan: AriaRetrievalPlan;
  }) => AriaResolvedRagStudentIdentity | null;
  readonly resolveProductionIdentity: (input: {
    readonly context: ProgrammeRagContext;
    readonly plan: AriaRetrievalPlan;
  }) => AriaResolvedRagStudentIdentity | null;
  readonly executeRetrieval: (
    plan: AriaRetrievalPlan,
    query: string,
    identity: AriaResolvedRagStudentIdentity,
  ) => Promise<AriaRagState>;
}

const defaultDependencies: ProgrammeRagV2Dependencies = {
  buildContext: buildAriaConversationContext,
  resolvePlan: resolveAriaRetrievalPlan,
  resolveDisposableIdentity: resolveDisposableAriaRagIdentity,
  resolveProductionIdentity: resolveProductionAriaRagIdentity,
  executeRetrieval: executeAriaRetrieval,
};

function pageFromHit(hit: AriaCitationHit): number | null {
  const candidates = [hit.citationPage, hit.locator?.page, hit.locator?.page_start];
  const page = candidates.find((value) =>
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0,
  );
  return typeof page === 'number' ? page : null;
}

function toProgrammeHit(hit: AriaCitationHit): ProgrammeRagV2Hit | null {
  const page = pageFromHit(hit);
  if (page === null || !hit.sourceDocument || !hit.provenance) return null;
  const source = hit.url ?? hit.sourceDocument;
  return Object.freeze({
    id: hit.chunkId ?? hit.id,
    document: hit.snippet,
    score: Math.round(Math.max(0, Math.min(1, hit.score ?? 0)) * 100),
    citation: Object.freeze({ label: hit.provenance, source, page }),
    metadata: Object.freeze({
      title: hit.sourceTitle,
      source,
      sourceLabel: hit.provenance,
      page,
    }),
  });
}

function buildProgrammeContext(hits: readonly ProgrammeRagV2Hit[]): string {
  return hits
    .map((hit) => `[${hit.metadata.title} — p. ${hit.citation.page}]\n${hit.document}`)
    .join('\n\n');
}

export async function searchProgrammeResourcesV2(
  input: {
    readonly actor: { readonly userId: string; readonly role: string };
    readonly courseKey: string;
    readonly query: string;
  },
  dependencies: ProgrammeRagV2Dependencies = defaultDependencies,
): Promise<ProgrammeRagV2Result> {
  const resolution = dependencies.resolvePlan(input.courseKey, 'DISCOVERY', 'TUTOR');
  if (resolution.status !== 'AVAILABLE') {
    return {
      status: 'UNAVAILABLE',
      source: 'none',
      hits: [],
      context: '',
      reason: resolution.reasonCode,
    };
  }

  const context = await dependencies.buildContext({
    actor: input.actor,
    courseKey: input.courseKey,
  });
  const identity = dependencies.resolveDisposableIdentity({ context, plan: resolution.plan })
    ?? dependencies.resolveProductionIdentity({ context, plan: resolution.plan });
  if (!identity) {
    return {
      status: 'UNAVAILABLE',
      source: 'none',
      hits: [],
      context: '',
      reason: 'ACADEMIC_CONTEXT_UNREPRESENTABLE',
    };
  }

  const retrieved = await dependencies.executeRetrieval(resolution.plan, input.query, identity);
  if (retrieved.status !== 'SUCCESS') {
    return {
      status: retrieved.status === 'NO_RESULTS' ? 'NO_RESULTS' : 'UNAVAILABLE',
      source: 'none',
      hits: [],
      context: '',
      ...('error' in retrieved
        ? { reason: retrieved.error }
        : 'reason' in retrieved
          ? { reason: retrieved.reason }
          : {}),
    };
  }

  const hits = retrieved.hits.map(toProgrammeHit);
  if (hits.some((hit) => hit === null)) {
    return {
      status: 'UNAVAILABLE',
      source: 'none',
      hits: [],
      context: '',
      reason: 'RAG_PROTOCOL_INVALID',
    };
  }
  const validHits = hits as ProgrammeRagV2Hit[];
  return {
    status: 'SUCCESS',
    source: 'rag-v2',
    hits: validHits,
    context: buildProgrammeContext(validHits),
  };
}
