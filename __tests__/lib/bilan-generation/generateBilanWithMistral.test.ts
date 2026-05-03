import { generateBilanMarkdownWithMistral } from '@/lib/bilan-generation/generateBilanWithMistral';
import { MistralConfigurationError, MistralGenerationError } from '@/lib/llm/mistral';

const MOCK_MARKDOWN = '## 1. Synthèse générale\nContenu test.';

describe('generateBilanMarkdownWithMistral', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('throws MistralConfigurationError if MISTRAL_API_KEY is missing', async () => {
    delete process.env.MISTRAL_API_KEY;
    await expect(
      generateBilanMarkdownWithMistral([{ role: 'user', content: 'test' }])
    ).rejects.toThrow(MistralConfigurationError);
  });

  it('returns markdown and model on success', async () => {
    process.env.MISTRAL_API_KEY = 'test-key';
    process.env.MISTRAL_MODEL = 'mistral-medium-latest';

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: MOCK_MARKDOWN } }],
      }),
    }) as jest.Mock;

    const result = await generateBilanMarkdownWithMistral([{ role: 'user', content: 'test' }]);
    expect(result.markdown).toBe(MOCK_MARKDOWN);
    expect(result.model).toBe('mistral-medium-latest');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('throws MistralGenerationError with RATE_LIMITED on 429', async () => {
    process.env.MISTRAL_API_KEY = 'test-key';

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 429,
    }) as jest.Mock;

    await expect(
      generateBilanMarkdownWithMistral([{ role: 'user', content: 'test' }])
    ).rejects.toThrow(MistralGenerationError);

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 429,
    }) as jest.Mock;

    try {
      await generateBilanMarkdownWithMistral([{ role: 'user', content: 'test' }]);
    } catch (e) {
      expect((e as MistralGenerationError).message).toBe('RATE_LIMITED');
    }
  });

  it('sends the model from env to the API body', async () => {
    process.env.MISTRAL_API_KEY = 'test-key';
    process.env.MISTRAL_MODEL = 'mistral-large-latest';

    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: MOCK_MARKDOWN } }],
      }),
    });
    global.fetch = mockFetch as jest.Mock;

    await generateBilanMarkdownWithMistral([{ role: 'user', content: 'test' }]);

    const calledBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(calledBody.model).toBe('mistral-large-latest');
  });

  it('does not log API key or message content', async () => {
    process.env.MISTRAL_API_KEY = 'super-secret-key';

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: MOCK_MARKDOWN } }],
      }),
    }) as jest.Mock;

    await generateBilanMarkdownWithMistral([{ role: 'user', content: 'sensitive-content' }]);

    const allLogs = [...logSpy.mock.calls, ...errorSpy.mock.calls]
      .flat()
      .join(' ');
    expect(allLogs).not.toContain('super-secret-key');
    expect(allLogs).not.toContain('sensitive-content');

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
