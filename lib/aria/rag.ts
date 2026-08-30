import { z } from 'zod';
import { ragSearch } from '@/lib/rag-client';
import type {
  AriaCitationHit,
  AriaCourseKey,
  AriaRagState,
  AriaRetrievalPlan,
} from './contracts';
import type { AriaPedagogicalMode } from './domain/pedagogy/pedagogical-mode';
import { getAriaRagCorpusCapability } from './infrastructure/rag/manifest';

const locatorSchema = z.record(z.string(), z.union([z.string(), z.number()]));
const canonicalHitMetadataSchema = z.object({
  resource_id: z.string().uuid(),
  resource_version_id: z.string().uuid(),
  content_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  chunk_id: z.string().min(1).max(200),
  locator: locatorSchema,
  corpus_id: z.string().min(1).max(64),
  corpus_version_id: z.string().min(1).max(64),
  manifest_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  title: z.string().min(1).max(500),
  source_uri: z.string().min(1).max(2_048),
  source_label: z.string().min(1).max(500),
  rights: z.string().min(1).max(100),
}).passthrough();

export function buildAriaRetrievalPlan(
  courseKey: AriaCourseKey,
  pedagogicalMode: AriaPedagogicalMode = 'DISCOVERY',
  agentRole: 'TUTOR' = 'TUTOR',
): AriaRetrievalPlan | null {
  const capability = getAriaRagCorpusCapability(courseKey, pedagogicalMode, agentRole);
  if (capability.status !== 'AVAILABLE') return null;
  return Object.freeze({
    courseKey,
    collection: capability.corpus.physicalCollection,
    corpusId: capability.corpus.corpusId,
    corpusVersionId: capability.corpus.corpusVersionId,
    manifestSha256: capability.corpus.manifestSha256,
    resourceRegistrySha256: capability.corpus.resourceRegistrySha256,
    academicYear: capability.corpus.academicYear,
    curriculumVersion: capability.corpus.curriculumVersion,
    resourceBindings: capability.corpus.resourceBindings,
  });
}

function sameLocator(
  left: Readonly<Record<string, string | number>>,
  right: Readonly<Record<string, string | number>>,
): boolean {
  const leftEntries = Object.entries(left).sort(([a], [b]) => a.localeCompare(b));
  const rightEntries = Object.entries(right).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
}

function validateHitAgainstPlan(
  plan: AriaRetrievalPlan,
  metadata: z.infer<typeof canonicalHitMetadataSchema>,
): void {
  if (metadata.corpus_id !== plan.corpusId
    || metadata.corpus_version_id !== plan.corpusVersionId
    || metadata.manifest_sha256 !== plan.manifestSha256) {
    throw new Error('RAG_RESPONSE_MANIFEST_IDENTITY_MISMATCH');
  }
  const resource = plan.resourceBindings.find((binding) =>
    binding.resourceId === metadata.resource_id
    && binding.resourceVersionId === metadata.resource_version_id
    && binding.contentSha256 === metadata.content_sha256);
  const chunk = resource?.chunks.find((binding) =>
    binding.chunkId === metadata.chunk_id && sameLocator(binding.locator, metadata.locator));
  if (!resource || !chunk) throw new Error('RAG_RESPONSE_RESOURCE_IDENTITY_MISMATCH');
}

export async function executeAriaRetrieval(
  plan: AriaRetrievalPlan | null,
  query: string,
  options?: { k?: number; scoreThreshold?: number },
): Promise<AriaRagState> {
  if (!plan) {
    return { status: 'NOT_CONFIGURED', reason: 'SERVABLE_CORPUS_NOT_CONFIGURED' };
  }
  if (!query.trim()) return { status: 'NO_RESULTS', plan };

  try {
    const hits = await ragSearch({
      query: query.trim(),
      collection: plan.collection,
      filters: {
        corpus_id: plan.corpusId,
        corpus_version_id: plan.corpusVersionId,
        manifest_sha256: plan.manifestSha256,
      },
      k: options?.k ?? 4,
      score_threshold: options?.scoreThreshold,
      failureMode: 'throw',
    });
    if (hits.length === 0) return { status: 'NO_RESULTS', plan };

    const citationHits: AriaCitationHit[] = hits.map((hit) => {
      const metadata = canonicalHitMetadataSchema.parse(hit.metadata);
      validateHitAgainstPlan(plan, metadata);
      return Object.freeze({
        id: hit.id,
        sourceTitle: metadata.title,
        sourceDocument: metadata.source_uri,
        courseKey: plan.courseKey,
        provenance: metadata.source_label,
        url: metadata.source_uri.startsWith('https://') ? metadata.source_uri : undefined,
        snippet: hit.document,
        score: hit.score ?? (1 - hit.distance),
        resourceId: metadata.resource_id,
        resourceVersionId: metadata.resource_version_id,
        contentSha256: metadata.content_sha256,
        chunkId: metadata.chunk_id,
        locator: metadata.locator,
        corpusId: metadata.corpus_id,
        corpusVersionId: metadata.corpus_version_id,
        manifestSha256: metadata.manifest_sha256,
      });
    });
    return { status: 'SUCCESS', hits: Object.freeze(citationHits), plan };
  } catch {
    return { status: 'RUNTIME_UNAVAILABLE', error: 'RAG_RUNTIME_UNAVAILABLE', plan };
  }
}
