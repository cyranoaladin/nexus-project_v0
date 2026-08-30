import { randomUUID } from 'node:crypto';
import { buildAriaPromptEnvelope } from './build-prompt';
import {
  makeRunAriaConversation,
  type AriaConversationExecutionDependencies,
  type AriaConversationExecutionResult,
  type RunAriaConversationInput,
} from './run-conversation';
import type { AriaCanonicalRetrievalOutcome } from './retrieval-evidence';
import { prismaAriaConversationRepository } from '../../infrastructure/prisma/conversation-repository';
import { buildAriaRetrievalPlan, executeAriaRetrieval } from '../../rag';
import { streamChatCompletion } from '../../gateway';
import { ariaConversationTelemetrySink } from '../../infrastructure/observability/telemetry';

async function executeCanonicalRetrieval(
  input: Parameters<AriaConversationExecutionDependencies['retrieve']>[0],
): Promise<AriaCanonicalRetrievalOutcome> {
  if (input.policy.kind === 'GENERAL_CHAT') return { status: 'NOT_CONFIGURED', hits: [] };
  const plan = buildAriaRetrievalPlan(input.context.courseKey, input.policy.task, 'TUTOR');
  if (!plan) return { status: 'NOT_CONFIGURED', hits: [] };
  const attempted = {
    manifestSha256: plan.manifestSha256,
    corpusId: plan.corpusId,
    corpusVersionId: plan.corpusVersionId,
  };
  const result = await executeAriaRetrieval(plan, input.query);
  if (result.status !== 'SUCCESS') return {
    status: result.status,
    hits: [],
    attempted,
    ...(result.status === 'RUNTIME_UNAVAILABLE' ? { failureReason: result.error } : {}),
  };
  return {
    status: 'SUCCESS',
    attempted,
    hits: result.hits.map((hit) => {
      if (!hit.resourceId || !hit.resourceVersionId || !hit.contentSha256
        || !hit.chunkId || !hit.locator || !hit.corpusId
        || !hit.corpusVersionId || !hit.manifestSha256) {
        throw new Error('Canonical RAG hit is missing immutable identity');
      }
      return {
        ...hit,
        resourceId: hit.resourceId,
        resourceVersionId: hit.resourceVersionId,
        contentSha256: hit.contentSha256,
        chunkId: hit.chunkId,
        locator: hit.locator,
        corpusId: hit.corpusId,
        corpusVersionId: hit.corpusVersionId,
        manifestSha256: hit.manifestSha256,
      };
    }),
  };
}

export const executeAriaConversation = makeRunAriaConversation({
  repository: prismaAriaConversationRepository,
  retrieve: executeCanonicalRetrieval,
  buildPrompt: (input) => buildAriaPromptEnvelope({
    courseKey: input.context.courseKey,
    pedagogicalMode: input.mode,
    agentRole: input.agentRole,
    skillId: input.context.skillId,
    resourceId: input.context.resourceId,
    citations: input.citations,
    conversationHistory: input.history,
    retrievalPolicy: input.policy.kind,
    ragStatus: input.ragStatus,
    userMessage: input.message,
  }),
  streamModel: (messages, options) => streamChatCompletion(messages, { signal: options.signal }),
  now: () => new Date(),
  createExecutionToken: randomUUID,
  monotonicNow: () => performance.now(),
  modelPolicy: 'ARIA_CHAT_DEFAULT_V1',
  telemetry: ariaConversationTelemetrySink,
});

export type {
  AriaConversationExecutionResult as AriaExecutionResult,
  RunAriaConversationInput as ExecuteAriaConversationParams,
};
