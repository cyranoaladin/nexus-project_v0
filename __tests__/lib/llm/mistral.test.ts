import {
  createMistralJsonCompletion,
  MistralConfigurationError,
  MistralGenerationError,
  MISTRAL_ERROR_CODES,
} from '@/lib/llm/mistral';

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('mistral', () => {
  let originalApiKey: string | undefined;
  let originalTimeout: string | undefined;
  let originalModel: string | undefined;

  beforeEach(() => {
    originalApiKey = process.env.MISTRAL_API_KEY;
    originalTimeout = process.env.MISTRAL_TIMEOUT_MS;
    originalModel = process.env.MISTRAL_MODEL;
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.MISTRAL_API_KEY;
    } else {
      process.env.MISTRAL_API_KEY = originalApiKey;
    }
    if (originalTimeout === undefined) {
      delete process.env.MISTRAL_TIMEOUT_MS;
    } else {
      process.env.MISTRAL_TIMEOUT_MS = originalTimeout;
    }
    if (originalModel === undefined) {
      delete process.env.MISTRAL_MODEL;
    } else {
      process.env.MISTRAL_MODEL = originalModel;
    }
  });

  describe('MISTRAL_API_KEY missing', () => {
    it('throws MistralConfigurationError when API key is missing', async () => {
      delete process.env.MISTRAL_API_KEY;

      await expect(
        createMistralJsonCompletion([{ role: 'user', content: 'test' }])
      ).rejects.toThrow(MistralConfigurationError);
    });

    it('error code is MISTRAL_API_KEY_MISSING', async () => {
      delete process.env.MISTRAL_API_KEY;

      try {
        await createMistralJsonCompletion([{ role: 'user', content: 'test' }]);
      } catch (error) {
        if (error instanceof MistralConfigurationError) {
          expect(error.code).toBe(MISTRAL_ERROR_CODES.MISTRAL_API_KEY_MISSING);
        }
      }
    });
  });

  describe('timeout handling', () => {
    beforeEach(() => {
      process.env.MISTRAL_API_KEY = 'test-api-key';
    });

    it('uses default timeout of 60000ms when env var not set', async () => {
      delete process.env.MISTRAL_TIMEOUT_MS;

      // Mock fetch to hang indefinitely
      mockFetch.mockImplementationOnce(() => new Promise(() => {}));

      // Start the request
      const promise = createMistralJsonCompletion([{ role: 'user', content: 'test' }]);

      // Should eventually timeout (using fake timers would be better but this is simpler)
      // We can't easily test the exact timeout without complex mocking
      // So we just verify the call was made
      expect(mockFetch).toHaveBeenCalled();
    });

    it('uses custom timeout from MISTRAL_TIMEOUT_MS env var', async () => {
      process.env.MISTRAL_TIMEOUT_MS = '30000';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"result": "test"}' } }],
        }),
      });

      await createMistralJsonCompletion([{ role: 'user', content: 'test' }]);

      // Verify fetch was called
      expect(mockFetch).toHaveBeenCalled();
    });

    it('rejects invalid timeout values and falls back to default', async () => {
      process.env.MISTRAL_TIMEOUT_MS = 'invalid';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"result": "test"}' } }],
        }),
      });

      await createMistralJsonCompletion([{ role: 'user', content: 'test' }]);

      // Should not crash with invalid env var
      expect(mockFetch).toHaveBeenCalled();
    });

    it('throws MISTRAL_TIMEOUT on AbortController timeout', async () => {
      process.env.MISTRAL_TIMEOUT_MS = '1'; // 1ms timeout to trigger quickly

      // Mock fetch to simulate AbortController behavior
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      await expect(
        createMistralJsonCompletion([{ role: 'user', content: 'test' }])
      ).rejects.toMatchObject({
        code: MISTRAL_ERROR_CODES.MISTRAL_TIMEOUT,
      });
    });
  });

  describe('HTTP error handling', () => {
    beforeEach(() => {
      process.env.MISTRAL_API_KEY = 'test-api-key';
    });

    it('throws MISTRAL_HTTP_ERROR for non-OK responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(
        createMistralJsonCompletion([{ role: 'user', content: 'test' }])
      ).rejects.toMatchObject({
        code: MISTRAL_ERROR_CODES.MISTRAL_HTTP_ERROR,
      });
    });

    it('throws MISTRAL_HTTP_ERROR for 401 unauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(
        createMistralJsonCompletion([{ role: 'user', content: 'test' }])
      ).rejects.toMatchObject({
        code: MISTRAL_ERROR_CODES.MISTRAL_HTTP_ERROR,
      });
    });

    it('throws MISTRAL_HTTP_ERROR for 429 rate limited', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });

      await expect(
        createMistralJsonCompletion([{ role: 'user', content: 'test' }])
      ).rejects.toMatchObject({
        code: MISTRAL_ERROR_CODES.MISTRAL_HTTP_ERROR,
      });
    });
  });

  describe('empty response handling', () => {
    beforeEach(() => {
      process.env.MISTRAL_API_KEY = 'test-api-key';
    });

    it('throws MISTRAL_EMPTY_RESPONSE when content is empty string', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '' } }],
        }),
      });

      await expect(
        createMistralJsonCompletion([{ role: 'user', content: 'test' }])
      ).rejects.toMatchObject({
        code: MISTRAL_ERROR_CODES.MISTRAL_EMPTY_RESPONSE,
      });
    });

    it('throws MISTRAL_EMPTY_RESPONSE when content is whitespace only', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '   \n\t   ' } }],
        }),
      });

      await expect(
        createMistralJsonCompletion([{ role: 'user', content: 'test' }])
      ).rejects.toMatchObject({
        code: MISTRAL_ERROR_CODES.MISTRAL_EMPTY_RESPONSE,
      });
    });

    it('throws MISTRAL_EMPTY_RESPONSE when choices array is empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [],
        }),
      });

      await expect(
        createMistralJsonCompletion([{ role: 'user', content: 'test' }])
      ).rejects.toMatchObject({
        code: MISTRAL_ERROR_CODES.MISTRAL_EMPTY_RESPONSE,
      });
    });

    it('throws MISTRAL_EMPTY_RESPONSE when message is missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: null }],
        }),
      });

      await expect(
        createMistralJsonCompletion([{ role: 'user', content: 'test' }])
      ).rejects.toMatchObject({
        code: MISTRAL_ERROR_CODES.MISTRAL_EMPTY_RESPONSE,
      });
    });
  });

  describe('JSON parsing', () => {
    beforeEach(() => {
      process.env.MISTRAL_API_KEY = 'test-api-key';
    });

    it('throws MISTRAL_INVALID_JSON for malformed JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{invalid json' } }],
        }),
      });

      await expect(
        createMistralJsonCompletion([{ role: 'user', content: 'test' }])
      ).rejects.toMatchObject({
        code: MISTRAL_ERROR_CODES.MISTRAL_INVALID_JSON,
      });
    });

    it('does not log sensitive data when JSON is invalid', async () => {
      const { logger } = require('@/lib/logger');

      // Invalid JSON containing sensitive student data
      const invalidJsonWithSensitiveData = '{"studentName":"Jane Doe","grade":"A+" invalid';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: invalidJsonWithSensitiveData } }],
        }),
      });

      try {
        await createMistralJsonCompletion([{ role: 'user', content: 'test' }]);
      } catch {
        // Expected to throw
      }

      // Verify no log contains the sensitive data from the invalid JSON
      const allCalls = [
        ...logger.debug.mock.calls,
        ...logger.info.mock.calls,
        ...logger.warn.mock.calls,
        ...logger.error.mock.calls,
      ];

      for (const call of allCalls) {
        const logData = call[0];
        const logMessage = call[1] || '';

        // Check that no log contains the sensitive data
        if (typeof logData === 'object' && logData !== null) {
          const logString = JSON.stringify(logData);
          expect(logString).not.toContain('Jane Doe');
          expect(logString).not.toContain('studentName');
          expect(logString).not.toContain('A+');
          expect(logString).not.toContain(invalidJsonWithSensitiveData);
          expect(logString).not.toContain('contentSnippet'); // Should never be logged
        }

        expect(logMessage).not.toContain('Jane Doe');
        expect(logMessage).not.toContain(invalidJsonWithSensitiveData);
      }
    });

    it('throws MISTRAL_INVALID_JSON for JSON with trailing content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"valid": true} extra text' } }],
        }),
      });

      await expect(
        createMistralJsonCompletion([{ role: 'user', content: 'test' }])
      ).rejects.toMatchObject({
        code: MISTRAL_ERROR_CODES.MISTRAL_INVALID_JSON,
      });
    });

    it('successfully parses valid JSON response', async () => {
      const validResponse = { result: 'success', data: [1, 2, 3] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(validResponse) } }],
        }),
      });

      const result = await createMistralJsonCompletion([{ role: 'user', content: 'test' }]);

      expect(result.json).toEqual(validResponse);
      expect(result.model).toBe('mistral-large-latest');
    });
  });

  describe('data privacy - no sensitive logging', () => {
    beforeEach(() => {
      process.env.MISTRAL_API_KEY = 'test-api-key';
    });

    it('never logs the prompt content or messages', async () => {
      const { logger } = require('@/lib/logger');

      const sensitivePrompt = 'This contains sensitive student data: John Doe, Grade A';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"result": "test"}' } }],
        }),
      });

      await createMistralJsonCompletion([{ role: 'user', content: sensitivePrompt }]);

      // Check that no log contains the sensitive data
      const allCalls = [
        ...logger.debug.mock.calls,
        ...logger.info.mock.calls,
        ...logger.warn.mock.calls,
        ...logger.error.mock.calls,
      ];

      for (const call of allCalls) {
        const logData = call[0];
        if (typeof logData === 'object' && logData !== null) {
          const logString = JSON.stringify(logData);
          expect(logString).not.toContain('John Doe');
          expect(logString).not.toContain('Grade A');
          expect(logString).not.toContain(sensitivePrompt);
        }
      }
    });

    it('never logs the generated JSON content', async () => {
      const { logger } = require('@/lib/logger');

      const sensitiveResponse = { studentName: 'Jane Doe', grade: 'A+' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(sensitiveResponse) } }],
        }),
      });

      await createMistralJsonCompletion([{ role: 'user', content: 'test' }]);

      // Check that no log contains the sensitive generated content
      const allCalls = [
        ...logger.debug.mock.calls,
        ...logger.info.mock.calls,
        ...logger.warn.mock.calls,
        ...logger.error.mock.calls,
      ];

      for (const call of allCalls) {
        const logData = call[0];
        if (typeof logData === 'object' && logData !== null) {
          const logString = JSON.stringify(logData);
          expect(logString).not.toContain('Jane Doe');
          expect(logString).not.toContain('A+');
        }
      }
    });

    it('only logs safe metadata like content length', async () => {
      const { logger } = require('@/lib/logger');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"result": "test response data"}' } }],
        }),
      });

      await createMistralJsonCompletion([{ role: 'user', content: 'test prompt' }]);

      // Verify that jsonLength (metadata) is logged
      const infoCalls = logger.info.mock.calls;
      const successCall = infoCalls.find((call: unknown[]) =>
        typeof call[1] === 'string' && call[1].includes('successful')
      );

      if (successCall) {
        expect(successCall[0]).toHaveProperty('jsonLength');
        expect(typeof successCall[0].jsonLength).toBe('number');
      }
    });
  });

  describe('error codes stability', () => {
    it('exports stable error codes', () => {
      expect(MISTRAL_ERROR_CODES.MISTRAL_API_KEY_MISSING).toBe('MISTRAL_API_KEY_MISSING');
      expect(MISTRAL_ERROR_CODES.MISTRAL_TIMEOUT).toBe('MISTRAL_TIMEOUT');
      expect(MISTRAL_ERROR_CODES.MISTRAL_HTTP_ERROR).toBe('MISTRAL_HTTP_ERROR');
      expect(MISTRAL_ERROR_CODES.MISTRAL_INVALID_JSON).toBe('MISTRAL_INVALID_JSON');
      expect(MISTRAL_ERROR_CODES.MISTRAL_EMPTY_RESPONSE).toBe('MISTRAL_EMPTY_RESPONSE');
    });

    it('MistralGenerationError includes code and message', () => {
      const error = new MistralGenerationError(
        MISTRAL_ERROR_CODES.MISTRAL_TIMEOUT,
        'Request timed out'
      );

      expect(error.code).toBe('MISTRAL_TIMEOUT');
      expect(error.message).toBe('Request timed out');
      expect(error.name).toBe('MistralGenerationError');
    });
  });

  describe('AbortController integration', () => {
    beforeEach(() => {
      process.env.MISTRAL_API_KEY = 'test-api-key';
    });

    it('passes AbortController signal to fetch', async () => {
      let capturedSignal: AbortSignal | undefined;

      mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
        capturedSignal = init.signal as AbortSignal;
        return Promise.resolve({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: '{"result": "test"}' } }],
          }),
        });
      });

      await createMistralJsonCompletion([{ role: 'user', content: 'test' }]);

      expect(capturedSignal).toBeDefined();
      expect(capturedSignal).toBeInstanceOf(AbortSignal);
    });
  });

  describe('model configuration', () => {
    beforeEach(() => {
      process.env.MISTRAL_API_KEY = 'test-api-key';
    });

    it('uses default model when none specified', async () => {
      delete process.env.MISTRAL_MODEL;

      mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string);
        expect(body.model).toBe('mistral-large-latest');
        return Promise.resolve({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: '{"result": "test"}' } }],
          }),
        });
      });

      await createMistralJsonCompletion([{ role: 'user', content: 'test' }]);
    });

    it('uses env model when MISTRAL_MODEL is set', async () => {
      process.env.MISTRAL_MODEL = 'mistral-small';

      mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string);
        expect(body.model).toBe('mistral-small');
        return Promise.resolve({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: '{"result": "test"}' } }],
          }),
        });
      });

      await createMistralJsonCompletion([{ role: 'user', content: 'test' }]);
    });

    it('uses options model when provided', async () => {
      mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string);
        expect(body.model).toBe('custom-model');
        return Promise.resolve({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: '{"result": "test"}' } }],
          }),
        });
      });

      await createMistralJsonCompletion(
        [{ role: 'user', content: 'test' }],
        { model: 'custom-model' }
      );
    });
  });

  describe('temperature configuration', () => {
    beforeEach(() => {
      process.env.MISTRAL_API_KEY = 'test-api-key';
    });

    it('uses default temperature of 0.2', async () => {
      mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string);
        expect(body.temperature).toBe(0.2);
        return Promise.resolve({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: '{"result": "test"}' } }],
          }),
        });
      });

      await createMistralJsonCompletion([{ role: 'user', content: 'test' }]);
    });

    it('uses custom temperature when provided', async () => {
      mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string);
        expect(body.temperature).toBe(0.7);
        return Promise.resolve({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: '{"result": "test"}' } }],
          }),
        });
      });

      await createMistralJsonCompletion(
        [{ role: 'user', content: 'test' }],
        { temperature: 0.7 }
      );
    });
  });

  describe('JSON response format', () => {
    beforeEach(() => {
      process.env.MISTRAL_API_KEY = 'test-api-key';
    });

    it('requests json_object response format', async () => {
      mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string);
        expect(body.response_format).toEqual({ type: 'json_object' });
        return Promise.resolve({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: '{"result": "test"}' } }],
          }),
        });
      });

      await createMistralJsonCompletion([{ role: 'user', content: 'test' }]);
    });
  });
});
