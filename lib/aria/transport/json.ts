import {
  executeAriaConversation,
  type AriaConversationExecutionResult,
  type RunAriaConversationInput,
} from '../application/conversation/public';
import { AriaError } from '../errors';

export interface AriaJsonResponseBody {
  readonly success: boolean;
  readonly conversation: { readonly id: string; readonly courseKey: string };
  readonly turn: {
    readonly id: string;
    readonly status: AriaConversationExecutionResult['status'];
    readonly disposition: AriaConversationExecutionResult['disposition'];
  };
  readonly message: {
    readonly id: string;
    readonly content: string;
    readonly citations: AriaConversationExecutionResult['citations'];
  };
  readonly metadata: {
    readonly turnId: string;
    readonly courseKey: string;
    readonly status: AriaConversationExecutionResult['status'];
    readonly disposition: AriaConversationExecutionResult['disposition'];
    readonly ragStatus?: AriaConversationExecutionResult['ragStatus'];
  };
}

export function toAriaJsonResponse(
  result: AriaConversationExecutionResult,
  courseKey: string,
): AriaJsonResponseBody {
  return {
    success: result.status !== 'ERROR',
    conversation: { id: result.conversationId, courseKey },
    turn: { id: result.turnId, status: result.status, disposition: result.disposition },
    message: { id: result.messageId, content: result.fullText, citations: result.citations },
    metadata: {
      turnId: result.turnId,
      courseKey,
      status: result.status,
      disposition: result.disposition,
      ...(result.ragStatus ? { ragStatus: result.ragStatus } : {}),
    },
  };
}

export async function executeAriaConversationJson(
  input: Omit<RunAriaConversationInput, 'onStart' | 'onDelta' | 'onComplete'>,
): Promise<AriaJsonResponseBody> {
  const result = await executeAriaConversation(input);
  if (result.status === 'ERROR') {
    throw new AriaError(
      result.failureCode ?? 'INTERNAL_ERROR',
      500,
      'L’exécution ARIA s’est terminée en erreur.',
    );
  }
  return toAriaJsonResponse(result, input.context.courseKey);
}
