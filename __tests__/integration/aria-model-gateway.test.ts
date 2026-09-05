/** @jest-environment node */

import OpenAI from 'openai';
import { streamChatCompletion } from '@/lib/aria/gateway';
import { resolveAriaProviderCandidates } from '@/lib/aria/infrastructure/model/config';

jest.mock('openai', () => {
  const create = jest.fn();
  return jest.fn().mockImplementation(() => ({ chat: { completions: { create } } }));
});

const keys = [
  'ARIA_MODEL_PROVIDER', 'ARIA_MODEL', 'ARIA_MODEL_BASE_URL', 'ARIA_MODEL_CAPABILITY_PROFILE',
  'ARIA_MODEL_FALLBACK_PROVIDER', 'ARIA_MODEL_FALLBACK_MODEL', 'ARIA_MODEL_FALLBACK_BASE_URL',
  'ARIA_MODEL_FALLBACK_API_KEY', 'ARIA_MODEL_FALLBACK_CAPABILITY_PROFILE',
  'ARIA_MODEL_FALLBACK_AUTHORIZED', 'OPENAI_API_KEY',
] as const;

describe('ARIA model gateway integration', () => {
  const originalEnvironment = { ...process.env };
  let create: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of keys) delete process.env[key];
    process.env.ARIA_MODEL_PROVIDER = 'OPENAI_HOSTED';
    process.env.ARIA_MODEL = 'gpt-4o-mini';
    process.env.ARIA_MODEL_CAPABILITY_PROFILE = 'TEXT_STANDARD';
    process.env.OPENAI_API_KEY = ['sk', 'proj', 'integration'.repeat(4)].join('-');
    create = new (OpenAI as unknown as new () => {
      chat: { completions: { create: jest.Mock } };
    })().chat.completions.create;
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env = { ...originalEnvironment };
  });

  it('I016 fails closed for missing configuration and classifies provider unavailability', async () => {
    expect(() => resolveAriaProviderCandidates({})).toThrow(
      expect.objectContaining({ code: 'INTERNAL_ERROR' }),
    );
    create.mockRejectedValueOnce(new Error('private provider payload'));
    const iterator = streamChatCompletion([{ role: 'user', content: 'Question' }]);
    await expect(iterator.next()).rejects.toMatchObject({ code: 'MODEL_UNAVAILABLE' });
  });

  it('I017 enforces timeout and allows only an explicitly authorized capability-equivalent fallback', async () => {
    jest.useFakeTimers();
    process.env.ARIA_MODEL_FALLBACK_PROVIDER = 'OPENAI_COMPATIBLE_LOCAL';
    process.env.ARIA_MODEL_FALLBACK_MODEL = 'gpt-4o-mini';
    process.env.ARIA_MODEL_FALLBACK_BASE_URL = 'http://127.0.0.1:11434/v1';
    process.env.ARIA_MODEL_FALLBACK_CAPABILITY_PROFILE = 'TEXT_STANDARD';
    process.env.ARIA_MODEL_FALLBACK_AUTHORIZED = 'true';
    create.mockReturnValueOnce(new Promise(() => undefined));
    const iterator = streamChatCompletion(
      [{ role: 'user', content: 'Question' }],
      { timeoutMs: 50, firstTokenTimeoutMs: 25 },
    );
    const pending = iterator.next();
    const rejection = expect(pending).rejects.toMatchObject({ code: 'MODEL_TIMEOUT' });
    await jest.advanceTimersByTimeAsync(26);
    await rejection;
  });
});
