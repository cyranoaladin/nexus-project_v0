export {
  buildAriaConversationContext,
  type AriaConversationContext,
  type BuildAriaConversationContextInput,
} from './build-context';

import { prismaAriaConversationRepository } from '../../infrastructure/prisma/conversation-repository';
import { makeClaimAriaConversationTurn } from './claim-turn';
import { makeReserveAriaConversationTurn } from './reserve-turn';
import { makeCancelAriaConversationTurn } from './cancel-turn';

export const reserveAriaConversationTurn = makeReserveAriaConversationTurn(
  prismaAriaConversationRepository,
);
export const claimAriaConversationTurn = makeClaimAriaConversationTurn(
  prismaAriaConversationRepository,
);
export const rejectReservedAriaConversationTurn =
  prismaAriaConversationRepository.rejectReservedTurn.bind(prismaAriaConversationRepository);
export const cancelAriaConversationTurn = makeCancelAriaConversationTurn(
  prismaAriaConversationRepository,
);
export const checkpointAriaTurnRetrieval = prismaAriaConversationRepository.checkpointRetrieval.bind(
  prismaAriaConversationRepository,
);
export const finalizeAriaConversationTurn = prismaAriaConversationRepository.finalizeTurn.bind(
  prismaAriaConversationRepository,
);
export const heartbeatAriaConversationTurn = prismaAriaConversationRepository.heartbeatTurn.bind(
  prismaAriaConversationRepository,
);
export type { ClaimAriaConversationTurnInput } from './claim-turn';
export type { ReserveAriaConversationTurnInput } from './reserve-turn';
export type { CancelAriaConversationTurnInput } from './cancel-turn';
export type {
  AriaConversationExecutionResult,
  AriaConversationStartEvent,
  RunAriaConversationInput,
} from './run-conversation';
export {
  executeAriaConversation,
  type AriaExecutionResult,
  type ExecuteAriaConversationParams,
} from './execute';
