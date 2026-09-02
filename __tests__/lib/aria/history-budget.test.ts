import {
  DEFAULT_ARIA_HISTORY_BUDGET,
  selectAriaPromptHistory,
  type AriaHistoryTurn,
} from '@/lib/aria/domain/conversation/history-budget';

function makeTurn(sequence: number, size = 20): AriaHistoryTurn {
  return {
    turnId: `turn-${sequence.toString().padStart(2, '0')}`,
    createdAt: new Date(`2026-08-30T10:${sequence.toString().padStart(2, '0')}:00.000Z`),
    user: { id: `user-${sequence}`, role: 'user', content: `U${sequence}-`.padEnd(size, 'u') },
    assistant: { id: `assistant-${sequence}`, role: 'assistant', content: `A${sequence}-`.padEnd(size, 'a') },
  };
}

describe('ARIA deterministic prompt history budget', () => {
  it('U026 ARIA-B-R020 selects the most recent complete Turns and reverses them chronologically', () => {
    const newestFirst = Array.from({ length: 8 }, (_, index) => makeTurn(8 - index));
    const selected = selectAriaPromptHistory(newestFirst, DEFAULT_ARIA_HISTORY_BUDGET);

    expect(selected).toHaveLength(10);
    expect(selected.map((message) => message.content.slice(0, 2))).toEqual([
      'U4', 'A4', 'U5', 'A5', 'U6', 'A6', 'U7', 'A7', 'U8', 'A8',
    ]);
  });

  it('U027 uses content cost rather than a permanent message count', () => {
    const newestFirst = Array.from({ length: 8 }, (_, index) => makeTurn(8 - index, 300));
    const selected = selectAriaPromptHistory(newestFirst, DEFAULT_ARIA_HISTORY_BUDGET);

    expect(selected.length).toBeLessThan(10);
    expect(selected.at(-1)?.content.startsWith('A8-')).toBe(true);
  });

  it('U029 never includes half a user/assistant pair when the next Turn exceeds the budget', () => {
    const selected = selectAriaPromptHistory(
      [makeTurn(2, 20), makeTurn(1, 20)],
      { ...DEFAULT_ARIA_HISTORY_BUDGET, maxUnits: 7 },
    );
    expect(selected).toHaveLength(2);
    expect(selected.map((message) => message.role)).toEqual(['user', 'assistant']);
  });
});
