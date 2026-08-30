import { randomUUID } from 'node:crypto';
import { buildAriaPromptEnvelope } from './application/conversation/build-prompt';
import {
  makeRunAriaConversation,
  type AriaConversationExecutionDependencies,
  type AriaConversationExecutionResult,
  type RunAriaConversationInput,
} from './application/conversation/run-conversation';
import type { AriaCanonicalRetrievalOutcome } from './application/conversation/retrieval-evidence';
import { prismaAriaConversationRepository } from './infrastructure/prisma/conversation-repository';
import { buildAriaRetrievalPlan, executeAriaRetrieval } from './rag';
import { streamChatCompletion } from './gateway';

async function executeCanonicalRetrieval(
  input: Parameters<AriaConversationExecutionDependencies['retrieve']>[0],
): Promise<AriaCanonicalRetrievalOutcome> {
  if (input.policy.kind === 'GENERAL_CHAT') {
    return { status: 'NOT_CONFIGURED', hits: [] };
  }
  const plan = buildAriaRetrievalPlan(input.context.courseKey);
  if (!plan?.manifestSha256 || !plan.corpusId || !plan.corpusVersionId) {
    return { status: 'NOT_CONFIGURED', hits: [] };
  }
  const attempted = {
    manifestSha256: plan.manifestSha256,
    corpusId: plan.corpusId,
    corpusVersionId: plan.corpusVersionId,
  };
  const result = await executeAriaRetrieval(plan, input.query);
  if (result.status !== 'SUCCESS') {
    return {
      status: result.status === 'CONFIGURED_BUT_CORPUS_UNKNOWN'
        || result.status === 'CORPUS_AVAILABLE'
        ? 'RUNTIME_UNAVAILABLE'
        : result.status,
      hits: [],
      attempted,
    };
  }
  return {
    status: 'SUCCESS',
    attempted,
    hits: result.hits.map((hit) => ({
      ...hit,
      resourceId: hit.resourceId ?? '',
      resourceVersionId: hit.resourceVersionId ?? '',
      contentSha256: hit.contentSha256 ?? '',
      chunkId: hit.chunkId ?? '',
      locator: hit.locator ?? {},
      corpusId: hit.corpusId ?? attempted.corpusId,
      corpusVersionId: hit.corpusVersionId ?? attempted.corpusVersionId,
      manifestSha256: hit.manifestSha256 ?? attempted.manifestSha256,
    })),
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
});

export type {
  AriaConversationExecutionResult as AriaExecutionResult,
  RunAriaConversationInput as ExecuteAriaConversationParams,
};
