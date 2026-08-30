/** @jest-environment node */

import { AriaError } from '@/lib/aria/errors';
import {
  ariaIntegrationInput,
  makeAriaApplicationFixture,
} from '../helpers/aria-application-fixture';

describe('ARIA terminal persistence boundary', () => {
  it('I019 exposes a failed terminal CAS instead of reporting a completed Turn', async () => {
    const persistenceFailure = new AriaError(
      'INTERNAL_ERROR',
      500,
      'La transition terminale conditionnelle a échoué.',
      { reasonCode: 'TURN_FINALIZATION_CAS_FAILED' },
    );
    const fixture = makeAriaApplicationFixture({
      repositoryOverrides: {
        finalizeTurn: jest.fn().mockRejectedValue(persistenceFailure),
      },
    });

    await expect(fixture.run(ariaIntegrationInput())).rejects.toBe(persistenceFailure);
    expect(fixture.repository.finalizeTurn).toHaveBeenCalledTimes(1);
    expect(fixture.telemetry.record).toHaveBeenCalledWith(expect.objectContaining({
      event: 'ERROR',
      finalState: 'ERROR',
      reasonCode: 'FINALIZATION_FAILED',
      turnId: 'turn-integration-1',
    }));
    expect(fixture.telemetry.record).not.toHaveBeenCalledWith(expect.objectContaining({
      event: 'COMPLETED',
    }));
  });
});
