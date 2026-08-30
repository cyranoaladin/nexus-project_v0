import OpenAI from 'openai';
import {
  resolveAriaModelTimeoutConfiguration,
  resolveAriaProviderCandidates,
} from '@/lib/aria/infrastructure/model/config';
import { streamChatCompletion } from '@/lib/aria/gateway';

jest.mock('openai', () => {
  const create = jest.fn();
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create } },
  }));
});

const modelEnvKeys = [
  'ARIA_MODEL_PROVIDER',
  'ARIA_MODEL',
  'ARIA_MODEL_BASE_URL',
  'ARIA_MODEL_CAPABILITY_PROFILE',
  'ARIA_MODEL_FALLBACK_PROVIDER',
  'ARIA_MODEL_FALLBACK_MODEL',
  'ARIA_MODEL_FALLBACK_BASE_URL',
  'ARIA_MODEL_FALLBACK_API_KEY',
  'ARIA_MODEL_FALLBACK_CAPABILITY_PROFILE',
  'ARIA_MODEL_FALLBACK_AUTHORIZED',
  'ARIA_MODEL_TIMEOUT_MS',
  'ARIA_MODEL_FIRST_TOKEN_TIMEOUT_MS',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
] as const;
const hostedCredential = ['sk', 'proj', 'a'.repeat(32)].join('-');

function setHostedEnvironment(): void {
  process.env.ARIA_MODEL_PROVIDER = 'OPENAI_HOSTED';
  process.env.ARIA_MODEL = 'configured-hosted-model';
  process.env.ARIA_MODEL_CAPABILITY_PROFILE = 'TEXT_STANDARD';
  Object.assign(process.env, { OPENAI_API_KEY: hostedCredential });
  delete process.env.OPENAI_BASE_URL;
}

describe('ARIA provider-neutral model gateway', () => {
  let mockCreate: jest.Mock;
  const originalEnvironment = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of modelEnvKeys) delete process.env[key];
    setHostedEnvironment();
    const openai = new (OpenAI as unknown as new () => {
      chat: { completions: { create: jest.Mock } };
    })();
    mockCreate = openai.chat.completions.create;
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env = { ...originalEnvironment };
  });

  it('U042 ARIA-B-R046 fails closed when hosted configuration has no real key', () => {
    for (const key of [undefined, '', 'ollama', 'test', 'sk-fake-key']) {
      const environment = {
        ARIA_MODEL_PROVIDER: 'OPENAI_HOSTED',
        ARIA_MODEL: 'configured-hosted-model',
        ARIA_MODEL_CAPABILITY_PROFILE: 'TEXT_STANDARD',
        ...(key === undefined ? {} : { OPENAI_API_KEY: key }),
      };
      expect(() => resolveAriaProviderCandidates(environment)).toThrow(
        expect.objectContaining({ code: 'INTERNAL_ERROR' }),
      );
    }
  });

  it('requires explicit local provider, base URL, model and capability profile', () => {
    expect(() => resolveAriaProviderCandidates({
      ARIA_MODEL_PROVIDER: 'OPENAI_COMPATIBLE_LOCAL',
      ARIA_MODEL: 'local-model',
      ARIA_MODEL_CAPABILITY_PROFILE: 'TEXT_STANDARD',
    })).toThrow(expect.objectContaining({ code: 'INTERNAL_ERROR' }));

    expect(resolveAriaProviderCandidates({
      ARIA_MODEL_PROVIDER: 'OPENAI_COMPATIBLE_LOCAL',
      ARIA_MODEL: 'local-model',
      ARIA_MODEL_BASE_URL: 'http://127.0.0.1:11434/v1',
      ARIA_MODEL_CAPABILITY_PROFILE: 'TEXT_STANDARD',
    })[0]).toMatchObject({
      provider: 'OPENAI_COMPATIBLE_LOCAL',
      model: 'local-model',
      baseURL: 'http://127.0.0.1:11434/v1',
    });

    expect(() => resolveAriaProviderCandidates({
      ARIA_MODEL_PROVIDER: 'OPENAI_COMPATIBLE_LOCAL',
      ARIA_MODEL: 'local-model',
      ARIA_MODEL_BASE_URL: 'https://api.openai.com/v1',
      ARIA_MODEL_CAPABILITY_PROFILE: 'TEXT_STANDARD',
    })).toThrow(expect.objectContaining({ code: 'INTERNAL_ERROR' }));
  });

  it('streams text chunks through the configured provider', async () => {
    async function* chunks() {
      yield { choices: [{ delta: { content: 'Étape 1 : ' } }] };
      yield { choices: [{ delta: { content: 'poser l’équation.' } }] };
    }
    mockCreate.mockResolvedValueOnce(chunks());

    const received: string[] = [];
    for await (const chunk of streamChatCompletion([{ role: 'user', content: 'test' }])) {
      received.push(chunk);
    }
    expect(received).toEqual(['Étape 1 : ', 'poser l’équation.']);
    expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: hostedCredential,
    }));
  });

  it('U044 ARIA-B-R043 enforces timeout even when provider creation ignores AbortSignal', async () => {
    jest.useFakeTimers();
    mockCreate.mockReturnValueOnce(new Promise(() => undefined));

    const execution = (async () => {
      for await (const chunk of streamChatCompletion(
        [{ role: 'user', content: 'timeout' }],
        { timeoutMs: 100 },
      )) {
        void chunk;
      }
    })();
    const rejection = expect(execution).rejects.toMatchObject({ code: 'MODEL_TIMEOUT' });
    await jest.advanceTimersByTimeAsync(101);
    await rejection;
    expect(jest.getTimerCount()).toBe(0);
  });

  it('enforces timeout while waiting for the next stream chunk', async () => {
    jest.useFakeTimers();
    async function* hangingStream() {
      yield { choices: [{ delta: { content: 'Début' } }] };
      await new Promise(() => undefined);
    }
    mockCreate.mockResolvedValueOnce(hangingStream());
    const iterator = streamChatCompletion(
      [{ role: 'user', content: 'timeout chunk' }],
      { timeoutMs: 100 },
    );
    await expect(iterator.next()).resolves.toMatchObject({ value: 'Début', done: false });
    const pending = iterator.next();
    const rejection = expect(pending).rejects.toMatchObject({ code: 'MODEL_TIMEOUT' });
    await jest.advanceTimersByTimeAsync(101);
    await rejection;
    expect(jest.getTimerCount()).toBe(0);
  });

  it('enforces the independent first-token timeout and clears it after the first chunk', async () => {
    jest.useFakeTimers();
    async function* delayedFirstChunk() {
      await new Promise(() => undefined);
      yield { choices: [{ delta: { content: 'Trop tard' } }] };
    }
    mockCreate.mockResolvedValueOnce(delayedFirstChunk());
    const iterator = streamChatCompletion(
      [{ role: 'user', content: 'first token timeout' }],
      { firstTokenTimeoutMs: 100, timeoutMs: 1_000 },
    );
    const pending = iterator.next();
    const rejection = expect(pending).rejects.toMatchObject({
      code: 'MODEL_TIMEOUT',
      internalDetails: { reasonCode: 'MODEL_FIRST_TOKEN_TIMEOUT' },
    });
    await jest.advanceTimersByTimeAsync(101);
    await rejection;
    expect(jest.getTimerCount()).toBe(0);
  });

  it('uses validated deployment timeout configuration when the caller does not override it', async () => {
    jest.useFakeTimers();
    process.env.ARIA_MODEL_TIMEOUT_MS = '100';
    process.env.ARIA_MODEL_FIRST_TOKEN_TIMEOUT_MS = '50';
    mockCreate.mockReturnValueOnce(new Promise(() => undefined));
    let rejection: unknown;
    const execution = (async () => {
      for await (const chunk of streamChatCompletion([{ role: 'user', content: 'configured timeout' }])) {
        void chunk;
      }
    })().catch((error: unknown) => {
      rejection = error;
    });
    await jest.advanceTimersByTimeAsync(51);
    expect(rejection).toMatchObject({
      code: 'MODEL_TIMEOUT',
      internalDetails: { reasonCode: 'MODEL_FIRST_TOKEN_TIMEOUT' },
    });
    await execution;
    expect(jest.getTimerCount()).toBe(0);
  });

  it('fails closed on invalid deployment timeout configuration', () => {
    for (const environment of [
      { ARIA_MODEL_TIMEOUT_MS: '0' },
      { ARIA_MODEL_TIMEOUT_MS: 'NaN' },
      { ARIA_MODEL_TIMEOUT_MS: '50', ARIA_MODEL_FIRST_TOKEN_TIMEOUT_MS: '51' },
    ]) {
      expect(() => resolveAriaModelTimeoutConfiguration(environment)).toThrow(
        expect.objectContaining({ code: 'INTERNAL_ERROR' }),
      );
    }
  });

  it('U045 ARIA-B-R044 distinguishes caller cancellation before and during provider execution', async () => {
    const before = new AbortController();
    before.abort('student-stop');
    const preCancelled = (async () => {
      for await (const chunk of streamChatCompletion(
        [{ role: 'user', content: 'cancelled' }],
        { signal: before.signal },
      )) {
        void chunk;
      }
    })();
    await expect(preCancelled).rejects.toMatchObject({ code: 'USER_CANCELLED' });
    expect(mockCreate).not.toHaveBeenCalled();

    const during = new AbortController();
    mockCreate.mockReturnValueOnce(new Promise(() => undefined));
    const pending = (async () => {
      for await (const chunk of streamChatCompletion(
        [{ role: 'user', content: 'cancel during' }],
        { signal: during.signal, timeoutMs: 10_000 },
      )) {
        void chunk;
      }
    })();
    during.abort('student-stop');
    await expect(pending).rejects.toMatchObject({ code: 'USER_CANCELLED' });
  });

  it.each(['TURN_LEASE_LOST', 'TURN_HEARTBEAT_FAILED'] as const)(
    'does not misclassify internal execution fencing as user cancellation: %s',
    async (reason) => {
      const controller = new AbortController();
      controller.abort(reason);
      const operation = (async () => {
        for await (const chunk of streamChatCompletion(
          [{ role: 'user', content: 'internal abort' }],
          { signal: controller.signal },
        )) {
          void chunk;
        }
      })();
      await expect(operation).rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
        internalDetails: { reasonCode: reason },
      });
    },
  );

  it('keeps USER_CANCELLED when caller cancellation wins before model deadlines', async () => {
    jest.useFakeTimers();
    const caller = new AbortController();
    const removeListener = jest.spyOn(caller.signal, 'removeEventListener');
    mockCreate.mockReturnValueOnce(new Promise(() => undefined));
    try {
      const operation = (async () => {
        for await (const chunk of streamChatCompletion(
          [{ role: 'user', content: 'cancel first' }],
          { signal: caller.signal, firstTokenTimeoutMs: 25, timeoutMs: 100 },
        )) void chunk;
      })();
      await Promise.resolve();
      const rejection = expect(operation).rejects.toMatchObject({
        code: 'USER_CANCELLED',
        internalDetails: { reasonCode: 'USER_CANCELLED' },
      });
      caller.abort('student-stop');
      jest.advanceTimersByTime(100);
      await rejection;
      expect(removeListener).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps the first-token timeout when later abort sources fire', async () => {
    jest.useFakeTimers();
    const caller = new AbortController();
    const removeListener = jest.spyOn(caller.signal, 'removeEventListener');
    mockCreate.mockReturnValueOnce(new Promise(() => undefined));
    try {
      const operation = (async () => {
        for await (const chunk of streamChatCompletion(
          [{ role: 'user', content: 'timeout first' }],
          { signal: caller.signal, firstTokenTimeoutMs: 25, timeoutMs: 100 },
        )) void chunk;
      })();
      await Promise.resolve();
      const rejection = expect(operation).rejects.toMatchObject({
        code: 'MODEL_TIMEOUT',
        internalDetails: { reasonCode: 'MODEL_FIRST_TOKEN_TIMEOUT' },
      });
      jest.advanceTimersByTime(25);
      caller.abort('student-stop');
      jest.advanceTimersByTime(75);
      await rejection;
      expect(removeListener).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it.each(['TURN_LEASE_LOST', 'TURN_HEARTBEAT_FAILED'] as const)(
    'keeps internal fencing as the first cause when a model timeout fires later: %s',
    async (reason) => {
      jest.useFakeTimers();
      const caller = new AbortController();
      mockCreate.mockReturnValueOnce(new Promise(() => undefined));
      try {
        const operation = (async () => {
          for await (const chunk of streamChatCompletion(
            [{ role: 'user', content: 'internal cancellation first' }],
            { signal: caller.signal, firstTokenTimeoutMs: 25, timeoutMs: 100 },
          )) void chunk;
        })();
        await Promise.resolve();
        const rejection = expect(operation).rejects.toMatchObject({
          code: 'INTERNAL_ERROR', internalDetails: { reasonCode: reason },
        });
        caller.abort(reason);
        jest.advanceTimersByTime(100);
        await rejection;
        expect(jest.getTimerCount()).toBe(0);
      } finally {
        jest.useRealTimers();
      }
    },
  );

  it('U043 ARIA-B-R045 classifies provider failures without exposing the raw payload', async () => {
    mockCreate.mockRejectedValueOnce(
      new Error(`provider 503 sk-secret /home/private child@example.com`),
    );
    const execution = (async () => {
      for await (const chunk of streamChatCompletion([{ role: 'user', content: 'test' }])) {
        void chunk;
      }
    })();
    await expect(execution).rejects.toMatchObject({
      code: 'MODEL_UNAVAILABLE',
      publicMessage: expect.not.stringContaining('sk-secret'),
    });
  });

  it('U047 ARIA-B-R047 uses a capability-equivalent fallback only when policy explicitly authorizes it', async () => {
    process.env.ARIA_MODEL_FALLBACK_PROVIDER = 'OPENAI_COMPATIBLE_LOCAL';
    process.env.ARIA_MODEL_FALLBACK_MODEL = 'local-fallback';
    process.env.ARIA_MODEL_FALLBACK_BASE_URL = 'http://127.0.0.1:11434/v1';
    process.env.ARIA_MODEL_FALLBACK_CAPABILITY_PROFILE = 'TEXT_STANDARD';
    process.env.ARIA_MODEL_FALLBACK_AUTHORIZED = '1';
    mockCreate.mockRejectedValueOnce(new Error('primary unavailable'));
    async function* fallbackChunks() {
      yield { choices: [{ delta: { content: 'Fallback explicite' } }] };
    }
    mockCreate.mockResolvedValueOnce(fallbackChunks());
    const onFallback = jest.fn();

    const received: string[] = [];
    for await (const chunk of streamChatCompletion(
      [{ role: 'user', content: 'test' }],
      { onFallback },
    )) {
      received.push(chunk);
    }
    expect(received).toEqual(['Fallback explicite']);
    expect(onFallback).toHaveBeenCalledWith(expect.objectContaining({
      fromProvider: 'OPENAI_HOSTED',
      toProvider: 'OPENAI_COMPATIBLE_LOCAL',
      reasonCode: 'PRIMARY_PROVIDER_UNAVAILABLE',
    }));
  });

  it('U048 does not silently use a configured fallback without authorization', async () => {
    process.env.ARIA_MODEL_FALLBACK_PROVIDER = 'OPENAI_COMPATIBLE_LOCAL';
    process.env.ARIA_MODEL_FALLBACK_MODEL = 'local-fallback';
    process.env.ARIA_MODEL_FALLBACK_BASE_URL = 'http://127.0.0.1:11434/v1';
    process.env.ARIA_MODEL_FALLBACK_CAPABILITY_PROFILE = 'TEXT_STANDARD';
    process.env.ARIA_MODEL_FALLBACK_AUTHORIZED = '0';
    mockCreate.mockRejectedValueOnce(new Error('primary unavailable'));

    const execution = (async () => {
      for await (const chunk of streamChatCompletion([{ role: 'user', content: 'test' }])) {
        void chunk;
      }
    })();
    await expect(execution).rejects.toMatchObject({ code: 'MODEL_UNAVAILABLE' });
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
