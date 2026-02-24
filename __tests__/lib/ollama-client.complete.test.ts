/**
 * Ollama Client — Complete Test Suite
 *
 * Tests: ollamaChat, ollamaGenerate, ollamaHealthCheck
 *
 * Source: lib/ollama-client.ts
 */

import { ollamaChat, ollamaGenerate, ollamaHealthCheck } from '@/lib/ollama-client';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── ollamaChat ──────────────────────────────────────────────────────────────

describe('ollamaChat', () => {
  it('should return content from successful chat', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'llama3.2',
        message: { role: 'assistant', content: 'Hello!' },
        done: true,
      }),
    });

    const result = await ollamaChat({
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(result).toBe('Hello!');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should send correct request body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: 'ok' } }),
    });

    await ollamaChat({
      messages: [{ role: 'user', content: 'test' }],
      temperature: 0.7,
      numPredict: 2048,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.stream).toBe(false);
    expect(body.options.temperature).toBe(0.7);
    expect(body.options.num_predict).toBe(2048);
  });

  it('should include format:json when requested', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: '{}' } }),
    });

    await ollamaChat({
      messages: [{ role: 'user', content: 'test' }],
      format: 'json',
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.format).toBe('json');
  });

  it('should throw on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    await expect(
      ollamaChat({ messages: [{ role: 'user', content: 'test' }] })
    ).rejects.toThrow('Ollama chat failed: 500');
  });

  it('should return empty string when message content is missing', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ message: {} }),
    });

    const result = await ollamaChat({
      messages: [{ role: 'user', content: 'test' }],
    });

    expect(result).toBe('');
  });

  it('should throw on fetch error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    await expect(
      ollamaChat({ messages: [{ role: 'user', content: 'test' }] })
    ).rejects.toThrow('Network error');
  });
});

// ─── ollamaGenerate ──────────────────────────────────────────────────────────

describe('ollamaGenerate', () => {
  it('should return response from successful generate', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'llama3.2',
        response: 'Generated text',
        done: true,
      }),
    });

    const result = await ollamaGenerate('Write a poem');

    expect(result).toBe('Generated text');
  });

  it('should throw on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'Model not found',
    });

    await expect(ollamaGenerate('test')).rejects.toThrow('Ollama generate failed: 404');
  });

  it('should return empty string when response is missing', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const result = await ollamaGenerate('test');
    expect(result).toBe('');
  });

  it('should include format:json when requested', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ response: '{}' }),
    });

    await ollamaGenerate('test', undefined, 'json');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.format).toBe('json');
  });

  it('should use custom model when provided', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'ok' }),
    });

    await ollamaGenerate('test', 'custom-model');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe('custom-model');
  });
});

// ─── ollamaHealthCheck ───────────────────────────────────────────────────────

describe('ollamaHealthCheck', () => {
  it('should return healthy with models list', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [{ name: 'llama3.2' }, { name: 'nomic-embed-text' }],
      }),
    });

    const result = await ollamaHealthCheck();

    expect(result.healthy).toBe(true);
    expect(result.models).toContain('llama3.2');
    expect(result.models).toContain('nomic-embed-text');
  });

  it('should return unhealthy on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false });

    const result = await ollamaHealthCheck();

    expect(result.healthy).toBe(false);
    expect(result.models).toEqual([]);
  });

  it('should return unhealthy on fetch error', async () => {
    mockFetch.mockRejectedValue(new Error('Connection refused'));

    const result = await ollamaHealthCheck();

    expect(result.healthy).toBe(false);
    expect(result.models).toEqual([]);
  });
});
