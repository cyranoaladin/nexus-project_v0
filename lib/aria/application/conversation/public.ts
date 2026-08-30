export {
  buildAriaConversationContext,
  type AriaConversationContext,
  type BuildAriaConversationContextInput,
} from './build-context';

import { prismaAriaConversationRepository } from '../../infrastructure/prisma/conversation-repository';
import { makeClaimAriaConversationTurn } from './claim-turn';
import { makeReserveAriaConversationTurn } from './reserve-turn';

export const reserveAriaConversationTurn = makeReserveAriaConversationTurn(
  prismaAriaConversationRepository,
);
export const claimAriaConversationTurn = makeClaimAriaConversationTurn(
  prismaAriaConversationRepository,
);
export type { ClaimAriaConversationTurnInput } from './claim-turn';
export type { ReserveAriaConversationTurnInput } from './reserve-turn';
