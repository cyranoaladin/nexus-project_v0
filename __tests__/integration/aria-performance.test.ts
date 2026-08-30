/** @jest-environment node */

import {
  inspectAriaPerformanceContract,
  measureAriaDeterministicPerformance,
} from '@/scripts/aria/check-performance';
import { ARIA_PERFORMANCE_BUDGETS } from '@/lib/aria/domain/observability/performance-budgets';
import {
  ariaIntegrationInput,
  makeAriaApplicationFixture,
} from '../helpers/aria-application-fixture';

describe('ARIA bounded execution performance contract', () => {
  it('I023 observes bounded queries/history/latencies and performs no persistence write per model token', async () => {
    const fixture = makeAriaApplicationFixture({
      dependencyOverrides: {
        streamModel: jest.fn(async function* () {
          for (let index = 0; index < 500; index += 1) yield `t${index} `;
        }),
        monotonicNow: (() => {
          let value = 0;
          return jest.fn(() => { value += 2; return value; });
        })(),
      },
    });
    await expect(fixture.run(ariaIntegrationInput())).resolves.toMatchObject({ status: 'COMPLETED' });
    expect(fixture.repository.loadRecentCompletedTurns).toHaveBeenCalledWith(expect.objectContaining({
      maxTurns: ARIA_PERFORMANCE_BUDGETS.historyCandidateTurnsMax,
    }));
    expect(fixture.repository.checkpointRetrieval).toHaveBeenCalledTimes(1);
    expect(fixture.repository.finalizeTurn).toHaveBeenCalledTimes(1);
    expect(fixture.telemetry.record).toHaveBeenCalledWith(expect.objectContaining({ event: 'RETRIEVAL' }));
    expect(fixture.telemetry.record).toHaveBeenCalledWith(expect.objectContaining({
      event: 'MODEL', timeToFirstTokenMs: expect.any(Number),
    }));
    expect(fixture.telemetry.record).toHaveBeenCalledWith(expect.objectContaining({ event: 'FINALIZE' }));

    expect(inspectAriaPerformanceContract(process.cwd())).toMatchObject({
      contextDbOperations: 1,
      dbWritesPerToken: 0,
    });
    const measured = measureAriaDeterministicPerformance(5);
    expect(measured.history100TurnsP95Ms).toBeLessThanOrEqual(ARIA_PERFORMANCE_BUDGETS.fixtureOverheadP95Ms);
    expect(measured.sse500EventsP95Ms).toBeLessThanOrEqual(ARIA_PERFORMANCE_BUDGETS.fixtureOverheadP95Ms);
  });
});
