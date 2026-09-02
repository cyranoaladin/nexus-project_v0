import { ARIA_PERFORMANCE_BUDGETS } from '@/lib/aria/domain/observability/performance-budgets';

describe('U064 ARIA deterministic performance budgets', () => {
  it('centralizes bounded context, history, RAG, model and persistence budgets', () => {
    expect(ARIA_PERFORMANCE_BUDGETS).toEqual(expect.objectContaining({
      contextDbOperationsMax: 8,
      historyCandidateTurnsMax: 50,
      historyBytesMax: 64 * 1024,
      messageCharactersMax: 1_500,
      ragTopK: 8,
      ragTopKMax: 20,
      ragResponseBytesMax: 256 * 1024,
      ragTimeoutMs: 5_000,
      firstTokenTimeoutMs: 15_000,
      totalModelTimeoutMs: 30_000,
      modelOutputCharactersMax: 64 * 1024,
      heartbeatIntervalMs: 10_000,
    }));
    expect(Object.isFrozen(ARIA_PERFORMANCE_BUDGETS)).toBe(true);
  });
});
