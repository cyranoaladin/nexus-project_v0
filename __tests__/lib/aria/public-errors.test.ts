import { serializeAriaPublicError } from '@/lib/aria/application/public-error';
import { AriaError } from '@/lib/aria/errors';

describe('ARIA stable public error serialization', () => {
  it.each([
    ['BAD_REQUEST', 400, 'BAD_REQUEST', false],
    ['COURSE_NOT_FOUND', 404, 'COURSE_NOT_FOUND', false],
    ['NOT_ENROLLED', 403, 'NOT_ENROLLED', false],
    ['NOT_ENTITLED', 403, 'NOT_ENTITLED', false],
    ['UNSUPPORTED', 422, 'UNSUPPORTED', false],
    ['CONVERSATION_NOT_FOUND', 404, 'CONVERSATION_NOT_FOUND', false],
    ['IDEMPOTENCY_CONFLICT', 409, 'IDEMPOTENCY_CONFLICT', false],
    ['CONVERSATION_BUSY', 409, 'CONVERSATION_BUSY', true],
    ['RAG_UNAVAILABLE', 503, 'RAG_UNAVAILABLE', true],
    ['MODEL_UNAVAILABLE', 503, 'MODEL_UNAVAILABLE', true],
    ['MODEL_TIMEOUT', 503, 'MODEL_UNAVAILABLE', true],
    ['INTERNAL_ERROR', 500, 'INTERNAL_ERROR', false],
  ] as const)('maps %s to %i/%s', (internalCode, status, publicCode, retryable) => {
    const result = serializeAriaPublicError(
      new AriaError(internalCode, 599, 'raw internal message'),
      { requestId: 'req_public_1', phase: 'PRE_STREAM' },
    );
    expect(result).toEqual({
      status,
      body: { error: { code: publicCode, requestId: 'req_public_1', retryable } },
    });
  });

  it.each(['CROSS_COURSE_MISMATCH', 'SKILL_MISMATCH', 'RESOURCE_MISMATCH'] as const)(
    'does not expose internal context guard code %s',
    (code) => {
      expect(serializeAriaPublicError(
        new AriaError(code, 409, 'sensitive mismatch'),
        { requestId: 'req_guard', phase: 'PRE_STREAM' },
      )).toMatchObject({ status: 400, body: { error: { code: 'BAD_REQUEST' } } });
    },
  );

  it('U058 enforces phase-specific public codes after a stream starts', () => {
    expect(serializeAriaPublicError(
      new AriaError('BAD_REQUEST', 400, 'late validation detail'),
      { requestId: 'req_late', phase: 'POST_START' },
    )).toMatchObject({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } });
    expect(serializeAriaPublicError(
      new AriaError('RAG_UNAVAILABLE', 503, 'provider detail'),
      { requestId: 'req_rag', phase: 'POST_START' },
    )).toMatchObject({ status: 503, body: { error: { code: 'RAG_UNAVAILABLE' } } });
  });

  it('U059 ARIA-B-R048 redacts paths and endpoints from client and server log', () => {
    const logger = { error: jest.fn() };
    const raw = '/home/alice/private https://provider.invalid/v1';
    const result = serializeAriaPublicError(
      new AriaError('MODEL_UNAVAILABLE', 503, raw, {
        reasonCode: 'PROVIDER_REQUEST_FAILED',
        raw,
      }),
      { requestId: 'req_redacted', phase: 'POST_START', logger },
    );

    const clientText = JSON.stringify(result.body);
    const logText = JSON.stringify(logger.error.mock.calls);
    for (const fragment of ['/home/alice', 'provider.invalid']) {
      expect(clientText).not.toContain(fragment);
      expect(logText).not.toContain(fragment);
    }
    expect(logText).toContain('req_redacted');
    expect(logText).toContain('PROVIDER_REQUEST_FAILED');
  });

  it('ARIA-B-R049 redacts email, account and provider payload fragments from client and log', () => {
    const logger = { error: jest.fn() };
    const raw = [
      'user', '@example.com', 'acct_123',
      ['provider', 'payload', 'raw'].join('='),
      ['credential', 'fragment'].join('-'),
    ].join(' ');
    const result = serializeAriaPublicError(
      new AriaError('MODEL_UNAVAILABLE', 503, raw, {
        reasonCode: 'PROVIDER_REQUEST_FAILED', raw,
      }),
      { requestId: 'req_redacted_payload', phase: 'POST_START', logger },
    );
    expect(JSON.stringify(result.body)).not.toContain(raw);
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(raw);
  });

  it('maps an unexpected exception to INTERNAL_ERROR without its stack or message', () => {
    const error = new Error('filesystem /srv/private and email child@example.com');
    error.stack = 'SECRET_STACK';
    const serialized = serializeAriaPublicError(error, {
      requestId: 'req_unknown',
      phase: 'PRE_STREAM',
    });
    expect(serialized).toEqual({
      status: 500,
      body: { error: { code: 'INTERNAL_ERROR', requestId: 'req_unknown', retryable: false } },
    });
    expect(JSON.stringify(serialized)).not.toContain('SECRET_STACK');
  });

  it('never logs an invalid or non-string internal reason code', () => {
    for (const reasonCode of ['lowercase-secret', 'A'.repeat(81), 42]) {
      const logger = { error: jest.fn() };
      serializeAriaPublicError(
        new AriaError('MODEL_UNAVAILABLE', 503, 'private', { reasonCode }),
        { requestId: 'req_invalid_reason', phase: 'POST_START', logger },
      );
      expect(logger.error).toHaveBeenCalledWith(
        'ARIA request failed',
        undefined,
        expect.objectContaining({ reasonCode: undefined }),
      );
    }
  });

  it('logs a safe INTERNAL_ERROR classification for an unexpected exception', () => {
    const logger = { error: jest.fn() };
    serializeAriaPublicError(new Error('private'), {
      requestId: 'req_unexpected_logged',
      phase: 'POST_START',
      logger,
    });
    expect(logger.error).toHaveBeenCalledWith('ARIA request failed', undefined, {
      requestId: 'req_unexpected_logged',
      code: 'INTERNAL_ERROR',
      phase: 'POST_START',
      reasonCode: undefined,
    });
  });
});
