/** @jest-environment node */

import { serializeAriaPublicError } from '@/lib/aria/application/public-error';
import { AriaError } from '@/lib/aria/errors';
import {
  ariaIntegrationInput,
  makeAriaApplicationFixture,
} from '../helpers/aria-application-fixture';

describe('ARIA observability and redaction composition', () => {
  it('I022 records lifecycle identifiers while excluding message/provider/PII details from telemetry and public errors', async () => {
    const sensitive = [
      '/srv/private/student',
      'student', '@example.invalid',
      ['provider', 'credential', 'fragment'].join('-'),
    ].join(' ');
    const fixture = makeAriaApplicationFixture({
      dependencyOverrides: {
        streamModel: jest.fn(async function* () {
          throw new Error(sensitive);
        }),
      },
    });

    await expect(fixture.run(ariaIntegrationInput())).resolves.toMatchObject({
      status: 'ERROR', failureCode: 'INTERNAL_ERROR',
    });
    const telemetryText = JSON.stringify(fixture.telemetry.record.mock.calls);
    expect(telemetryText).toContain('request-integration-1');
    expect(telemetryText).toContain('turn-integration-1');
    expect(telemetryText).toContain('ERROR');
    expect(telemetryText).not.toContain('Explique ce point');
    expect(telemetryText).not.toContain(sensitive);

    const logger = { error: jest.fn() };
    const serialized = serializeAriaPublicError(
      new AriaError('MODEL_UNAVAILABLE', 503, sensitive, {
        reasonCode: 'PROVIDER_REQUEST_FAILED', sensitive,
      }),
      { requestId: 'request-integration-1', phase: 'POST_START', logger },
    );
    expect(serialized).toEqual({
      status: 503,
      body: { error: {
        code: 'MODEL_UNAVAILABLE', requestId: 'request-integration-1', retryable: true,
      } },
    });
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(sensitive);
  });
});
