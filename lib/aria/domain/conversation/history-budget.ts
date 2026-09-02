import { ARIA_PERFORMANCE_BUDGETS } from '../observability/performance-budgets';

export interface AriaHistoryMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

export interface AriaHistoryTurn {
  readonly turnId: string;
  readonly createdAt: Date;
  readonly user: AriaHistoryMessage & { readonly role: 'user' };
  readonly assistant: AriaHistoryMessage & { readonly role: 'assistant' };
}

export interface AriaHistoryBudget {
  readonly maxCandidateTurns: number;
  readonly maxUnits: number;
  readonly baseUnitsPerMessage: number;
  readonly charactersPerUnit: number;
}

export const DEFAULT_ARIA_HISTORY_BUDGET: AriaHistoryBudget = Object.freeze({
  maxCandidateTurns: ARIA_PERFORMANCE_BUDGETS.historyCandidateTurnsMax,
  maxUnits: 30,
  baseUnitsPerMessage: 2,
  charactersPerUnit: 64,
});

function messageCost(message: AriaHistoryMessage, budget: AriaHistoryBudget): number {
  return budget.baseUnitsPerMessage + Math.ceil(message.content.length / budget.charactersPerUnit);
}

export function selectAriaPromptHistory(
  turns: readonly AriaHistoryTurn[],
  budget: AriaHistoryBudget,
): readonly AriaHistoryMessage[] {
  const newestFirst = [...turns].sort((left, right) => {
    const byCreatedAt = right.createdAt.getTime() - left.createdAt.getTime();
    return byCreatedAt || right.turnId.localeCompare(left.turnId);
  }).slice(0, budget.maxCandidateTurns);

  const selectedNewestFirst: AriaHistoryTurn[] = [];
  let usedUnits = 0;
  for (const turn of newestFirst) {
    const turnCost = messageCost(turn.user, budget) + messageCost(turn.assistant, budget);
    if (usedUnits + turnCost > budget.maxUnits) break;
    selectedNewestFirst.push(turn);
    usedUnits += turnCost;
  }

  return selectedNewestFirst.reverse().flatMap((turn) => [turn.user, turn.assistant]);
}
