import { AriaError } from '@/lib/aria/errors';
import {
  AriaSSEParseError,
  formatAriaSSEEvent,
  parseAriaSSEResponse,
  prepareAriaSSEConversation,
  type AriaSSECallbacks,
} from '@/lib/aria/transport/sse';
import { toAriaJsonResponse } from '@/lib/aria/transport/json';

const encoder = new TextEncoder();

function streamBytes(chunks: readonly Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

function responseFromStrings(chunks: readonly string[], contentType = 'text/event-stream; charset=utf-8') {
  return new Response(streamBytes(chunks.map((chunk) => encoder.encode(chunk))), {
    headers: { 'Content-Type': contentType },
  });
}

describe('canonical ARIA SSE protocol', () => {
  it('formats only runtime-valid typed events', () => {
    expect(formatAriaSSEEvent({ event: 'delta', data: { text: 'bonjour' } }))
      .toBe('event: delta\ndata: {"text":"bonjour"}\n\n');
    expect(() => formatAriaSSEEvent({ event: 'delta', data: { text: 4 } } as never))
      .toThrow(AriaSSEParseError);
  });

  it('U049 ARIA-B-R080 parses a fragmented event with CRLF and explicit heartbeat', async () => {
    const seen: string[] = [];
    const response = responseFromStrings([
      'event: start\r\ndata: {"turnId":"t-1","conversationId":"c-1",',
      '"messageId":"m-1","courseKey":"eds-maths-premiere","status":"RUNNING","disposition":"EXECUTED"}\r\n\r\n',
      'event: heartbeat\ndata: {"timestamp":"2026-08-30T12:00:00.000Z"}\n\n'
        + 'event: delta\ndata: {"text":"Bonjour"}\n\n',
      'event: metadata\ndata: {"turnId":"t-1","courseKey":"eds-maths-premiere","status":"COMPLETED","disposition":"EXECUTED","ragStatus":"SUCCESS"}\n\n'
        + 'event: done\ndata: {"turnId":"t-1","messageId":"m-1","status":"COMPLETED","fullText":"Bonjour"}\n\n',
    ]);
    await parseAriaSSEResponse(response, {
      onStart: () => seen.push('start'),
      onHeartbeat: () => seen.push('heartbeat'),
      onDelta: ({ text }) => seen.push(`delta:${text}`),
      onMetadata: () => seen.push('metadata'),
      onDone: () => seen.push('done'),
    });
    expect(seen).toEqual(['start', 'heartbeat', 'delta:Bonjour', 'metadata', 'done']);
  });

  it('U050 ARIA-B-R079 preserves UTF-8 when a multibyte character is split across network chunks', async () => {
    const wire = encoder.encode(
      'event: start\ndata: {"turnId":"t","conversationId":"c","messageId":"m","courseKey":"eds-maths-premiere","status":"RUNNING","disposition":"EXECUTED"}\n\n'
      + 'event: delta\ndata: {"text":"méthode 🧠"}\n\n'
      + 'event: done\ndata: {"turnId":"t","messageId":"m","status":"COMPLETED","fullText":"méthode 🧠"}\n\n',
    );
    const emojiStart = wire.findIndex((byte) => byte === 0xf0);
    const response = new Response(streamBytes([
      wire.slice(0, emojiStart + 1),
      wire.slice(emojiStart + 1, emojiStart + 3),
      wire.slice(emojiStart + 3),
    ]), { headers: { 'Content-Type': 'text/event-stream' } });
    const deltas: string[] = [];
    await parseAriaSSEResponse(response, { onDelta: ({ text }) => deltas.push(text) });
    expect(deltas).toEqual(['méthode 🧠']);
  });

  it('U051 ARIA-B-R081 parses multiple complete events delivered in one chunk', async () => {
    const sequence: string[] = [];
    await parseAriaSSEResponse(responseFromStrings([
      'event: start\ndata: {"turnId":"t","conversationId":"c","messageId":"m","courseKey":"eds-maths-premiere","status":"RUNNING","disposition":"EXECUTED"}\n\n'
      + 'event: delta\ndata: {"text":"un"}\n\n'
      + 'event: delta\ndata: {"text":"deux"}\n\n'
      + 'event: done\ndata: {"turnId":"t","messageId":"m","status":"COMPLETED","fullText":"undeux"}\n\n',
    ]), {
      onStart: () => sequence.push('start'),
      onDelta: ({ text }) => sequence.push(text),
      onDone: () => sequence.push('done'),
    });
    expect(sequence).toEqual(['start', 'un', 'deux', 'done']);
  });

  it('U055 ARIA-B-R084 flushes and validates a final event without a trailing separator', async () => {
    const events: string[] = [];
    await parseAriaSSEResponse(responseFromStrings([
      'event: start\ndata: {"turnId":"t","conversationId":"c","messageId":"m","courseKey":"eds-maths-premiere","status":"RUNNING","disposition":"EXECUTED"}\n\n',
      'event: done\ndata: {"turnId":"t","messageId":"m","status":"CANCELLED","fullText":"partiel"}',
    ]), {
      onStart: () => events.push('start'),
      onDone: ({ status }) => events.push(status),
    });
    expect(events).toEqual(['start', 'CANCELLED']);
  });

  it.each([
    ['U052 ARIA-B-R076 invalid JSON', 'event: start\ndata: {oops}\n\n'],
    ['U053 ARIA-B-R077 wrong payload shape', 'event: start\ndata: {"turnId":4}\n\n'],
    ['U054 ARIA-B-R078 unknown event', 'event: surprise\ndata: {}\n\n'],
  ])('fails typed on %s', async (_label, wire) => {
    const onProtocolError = jest.fn();
    await expect(parseAriaSSEResponse(responseFromStrings([wire]), { onProtocolError }))
      .rejects.toBeInstanceOf(AriaSSEParseError);
    expect(onProtocolError).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid Content-Type before consuming bytes', async () => {
    await expect(parseAriaSSEResponse(responseFromStrings([], 'application/json'), {}))
      .rejects.toMatchObject({ code: 'INVALID_CONTENT_TYPE' });
  });

  it('rejects an empty SSE response because every execution requires start and terminal events', async () => {
    await expect(parseAriaSSEResponse(responseFromStrings([]), {}))
      .rejects.toMatchObject({ code: 'START_EVENT_REQUIRED' });
  });

  it('rejects a second terminal event and a started stream without a terminal event', async () => {
    const start = 'event: start\ndata: {"turnId":"t","conversationId":"c","messageId":"m","courseKey":"eds-maths-premiere","status":"RUNNING","disposition":"EXECUTED"}\n\n';
    const done = 'event: done\ndata: {"turnId":"t","messageId":"m","status":"COMPLETED","fullText":"ok"}\n\n';
    await expect(parseAriaSSEResponse(responseFromStrings([start + done + done]), {}))
      .rejects.toMatchObject({ code: 'TERMINAL_EVENT_DUPLICATED' });
    await expect(parseAriaSSEResponse(responseFromStrings([start]), {}))
      .rejects.toMatchObject({ code: 'TERMINAL_EVENT_MISSING' });
  });

  it('U057 ARIA-B-R085 cancels the reader when the caller AbortSignal fires', async () => {
    const controller = new AbortController();
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(streamController) {
        streamController.enqueue(encoder.encode(
          'event: start\ndata: {"turnId":"t","conversationId":"c","messageId":"m","courseKey":"eds-maths-premiere","status":"RUNNING","disposition":"EXECUTED"}\n\n',
        ));
      },
      cancel() { cancelled = true; },
    });
    const parsing = parseAriaSSEResponse(
      new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }),
      {},
      { signal: controller.signal },
    );
    await Promise.resolve();
    controller.abort('student navigation');
    await expect(parsing).rejects.toMatchObject({ code: 'ABORTED' });
    expect(cancelled).toBe(true);
  });

  it('starts execution before returning a stream and emits one canonical terminal result', async () => {
    const execute = jest.fn(async (input: {
      onStart?: (event: Record<string, unknown>) => void;
      onDelta?: (text: string) => void;
    }) => {
      input.onStart?.({
        turnId: 'turn-1', conversationId: 'conversation-1', messageId: 'message-1',
        status: 'RUNNING', disposition: 'EXECUTED',
      });
      input.onDelta?.('Réponse');
      return {
        turnId: 'turn-1', conversationId: 'conversation-1', messageId: 'message-1',
        status: 'COMPLETED', disposition: 'EXECUTED', fullText: 'Réponse',
        ragStatus: 'SUCCESS', citations: [],
      };
    });
    const prepared = await prepareAriaSSEConversation({
      executionInput: {
        context: { courseKey: 'eds-maths-premiere' } as never,
        clientRequestId: '00000000-0000-4000-8000-000000000001',
        message: 'Question',
      },
      requestId: 'request-1',
      execute: execute as never,
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(prepared.kind).toBe('STREAM');
    if (prepared.kind !== 'STREAM') throw new Error('ARIA_TEST_STREAM_REQUIRED');
    const seen: string[] = [];
    const callbacks: AriaSSECallbacks = {
      onStart: () => seen.push('start'),
      onDelta: () => seen.push('delta'),
      onMetadata: () => seen.push('metadata'),
      onDone: () => seen.push('done'),
    };
    await parseAriaSSEResponse(
      new Response(prepared.stream, { headers: { 'Content-Type': 'text/event-stream' } }),
      callbacks,
    );
    expect(seen).toEqual(['start', 'delta', 'metadata', 'done']);
  });

  it('keeps JSON and SSE metadata byte-for-field equivalent for the same canonical result', async () => {
    const result = {
      turnId: 'turn-parity', conversationId: 'conversation-parity', messageId: 'message-parity',
      status: 'COMPLETED' as const, disposition: 'REPLAY' as const, fullText: 'Persisté',
      ragStatus: 'NO_RESULTS' as const, citations: [],
    };
    const json = toAriaJsonResponse(result, 'eds-maths-premiere');
    const prepared = await prepareAriaSSEConversation({
      executionInput: {
        context: { courseKey: 'eds-maths-premiere' } as never,
        clientRequestId: '00000000-0000-4000-8000-000000000005',
        message: 'Retry',
      },
      requestId: 'request-parity',
      execute: (async (input: { onStart?: (event: Record<string, unknown>) => void }) => {
        input.onStart?.({
          turnId: result.turnId,
          conversationId: result.conversationId,
          messageId: result.messageId,
          status: result.status,
          disposition: result.disposition,
        });
        return result;
      }) as never,
    });
    if (prepared.kind !== 'STREAM') throw new Error('ARIA_TEST_STREAM_REQUIRED');
    const metadata: unknown[] = [];
    await parseAriaSSEResponse(
      new Response(prepared.stream, { headers: { 'Content-Type': 'text/event-stream' } }),
      { onMetadata: (value) => metadata.push(value) },
    );
    expect(metadata).toEqual([json.metadata]);
  });

  it('keeps reservation errors pre-stream and maps an active idempotent Turn to 202 metadata', async () => {
    await expect(prepareAriaSSEConversation({
      executionInput: {
        context: { courseKey: 'eds-maths-premiere' } as never,
        clientRequestId: '00000000-0000-4000-8000-000000000002',
        message: 'Question',
      },
      requestId: 'request-2',
      execute: jest.fn().mockRejectedValue(
        new AriaError('CONVERSATION_BUSY', 409, 'internal busy detail'),
      ) as never,
    })).rejects.toMatchObject({ code: 'CONVERSATION_BUSY' });

    const prepared = await prepareAriaSSEConversation({
      executionInput: {
        context: { courseKey: 'eds-maths-premiere' } as never,
        clientRequestId: '00000000-0000-4000-8000-000000000003',
        message: 'Question',
      },
      requestId: 'request-3',
      execute: (async (input: { onStart?: (event: Record<string, unknown>) => void }) => {
        input.onStart?.({
          turnId: 'turn-active', conversationId: 'conversation-1', messageId: 'message-active',
          status: 'RUNNING', disposition: 'IN_PROGRESS',
        });
        return {
          turnId: 'turn-active', conversationId: 'conversation-1', messageId: 'message-active',
          status: 'RUNNING', disposition: 'IN_PROGRESS', fullText: '', citations: [],
        };
      }) as never,
    });
    expect(prepared).toMatchObject({
      kind: 'IN_PROGRESS',
      result: { turnId: 'turn-active', status: 'RUNNING' },
    });
  });

  it('U056 ARIA-B-R088 emits one redacted typed error when execution fails after streaming began', async () => {
    const logger = { error: jest.fn() };
    const prepared = await prepareAriaSSEConversation({
      executionInput: {
        context: { courseKey: 'eds-maths-premiere' } as never,
        clientRequestId: '00000000-0000-4000-8000-000000000004',
        message: 'Question',
      },
      requestId: 'request-error',
      logger,
      execute: (async (input: {
        onStart?: (event: Record<string, unknown>) => void;
        onDelta?: (text: string) => void;
      }) => {
        input.onStart?.({
          turnId: 'turn-error', conversationId: 'conversation-1', messageId: 'message-1',
          status: 'RUNNING', disposition: 'EXECUTED',
        });
        input.onDelta?.('partiel');
        throw new AriaError(
          'MODEL_TIMEOUT',
          504,
          'provider secret /private/runtime endpoint@example.test',
        );
      }) as never,
    });
    if (prepared.kind !== 'STREAM') throw new Error('ARIA_TEST_STREAM_REQUIRED');
    const errors: unknown[] = [];
    const deltas: string[] = [];
    await parseAriaSSEResponse(
      new Response(prepared.stream, { headers: { 'Content-Type': 'text/event-stream' } }),
      {
        onDelta: ({ text }) => deltas.push(text),
        onError: (error) => errors.push(error),
      },
    );
    expect(deltas).toEqual(['partiel']);
    expect(errors).toEqual([{
      code: 'MODEL_UNAVAILABLE', requestId: 'request-error', retryable: true,
    }]);
    expect(JSON.stringify(errors)).not.toContain('provider secret');
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('emits persisted RAG metadata before the safe terminal error for an ERROR outcome', async () => {
    const prepared = await prepareAriaSSEConversation({
      executionInput: {
        context: { courseKey: 'eds-maths-premiere' } as never,
        clientRequestId: '00000000-0000-4000-8000-000000000006',
        message: 'Question',
      },
      requestId: 'request-terminal-error',
      execute: (async (input: { onStart?: (event: Record<string, unknown>) => void }) => {
        input.onStart?.({
          turnId: 'turn-error', conversationId: 'conversation-1', messageId: 'message-1',
          status: 'RUNNING', disposition: 'EXECUTED',
        });
        return {
          turnId: 'turn-error', conversationId: 'conversation-1', messageId: 'message-1',
          status: 'ERROR', disposition: 'EXECUTED', fullText: 'partiel',
          ragStatus: 'SUCCESS', citations: [], failureCode: 'MODEL_TIMEOUT',
        };
      }) as never,
    });
    if (prepared.kind !== 'STREAM') throw new Error('ARIA_TEST_STREAM_REQUIRED');
    const sequence: string[] = [];
    const errors: unknown[] = [];
    await parseAriaSSEResponse(
      new Response(prepared.stream, { headers: { 'Content-Type': 'text/event-stream' } }),
      {
        onMetadata: ({ ragStatus }) => sequence.push(`metadata:${ragStatus}`),
        onError: (error) => { sequence.push('error'); errors.push(error); },
      },
    );
    expect(sequence).toEqual(['metadata:SUCCESS', 'error']);
    expect(errors).toEqual([{
      code: 'MODEL_UNAVAILABLE', requestId: 'request-terminal-error', retryable: true,
    }]);
  });

  it('fails typed when a shape-valid event belongs to another Turn, message or course', async () => {
    const start = 'event: start\ndata: {"turnId":"turn-a","conversationId":"conversation-a","messageId":"message-a","courseKey":"eds-maths-premiere","status":"RUNNING","disposition":"EXECUTED"}\n\n';
    const mismatches = [
      'event: metadata\ndata: {"turnId":"turn-b","courseKey":"eds-maths-premiere","status":"COMPLETED","disposition":"EXECUTED"}\n\n',
      'event: done\ndata: {"turnId":"turn-a","messageId":"message-b","status":"COMPLETED","fullText":"ok"}\n\n',
      `event: citation\ndata: ${JSON.stringify({ citation: {
        id: 'citation-1', resourceId: 'resource-1', resourceVersionId: 'version-1',
        contentSha256: 'a'.repeat(64), chunkId: 'chunk-1', locator: { page: 1 },
        corpusId: 'corpus-1', corpusVersionId: 'corpus-version-1',
        manifestSha256: 'b'.repeat(64), sourceTitle: 'Source', sourceDocument: 'source.pdf',
        courseKey: 'eds-nsi-premiere', provenance: 'OFFICIEL_MEN', snippet: 'Extrait',
      } })}\n\n`,
    ];
    for (const mismatch of mismatches) {
      await expect(parseAriaSSEResponse(responseFromStrings([start + mismatch]), {}))
        .rejects.toMatchObject({ code: 'EVENT_IDENTITY_MISMATCH' });
    }
  });

  it('converts an invalid canonical result event into one safe terminal error and closes', async () => {
    const prepared = await prepareAriaSSEConversation({
      executionInput: {
        context: { courseKey: 'eds-maths-premiere' } as never,
        clientRequestId: '00000000-0000-4000-8000-000000000007',
        message: 'Question',
      },
      requestId: 'request-invalid-event',
      execute: (async (input: { onStart?: (event: Record<string, unknown>) => void }) => {
        input.onStart?.({
          turnId: 'turn-invalid', conversationId: 'conversation-1', messageId: 'message-1',
          status: 'RUNNING', disposition: 'EXECUTED',
        });
        return {
          turnId: 'turn-invalid', conversationId: 'conversation-1', messageId: 'message-1',
          status: 'COMPLETED', disposition: 'EXECUTED', fullText: 'Réponse', ragStatus: 'SUCCESS',
          citations: [{ id: 'invalid-citation', contentSha256: 'not-a-hash' }],
        };
      }) as never,
    });
    if (prepared.kind !== 'STREAM') throw new Error('ARIA_TEST_STREAM_REQUIRED');
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort('test-timeout'), 100);
    const errors: unknown[] = [];
    try {
      await parseAriaSSEResponse(
        new Response(prepared.stream, { headers: { 'Content-Type': 'text/event-stream' } }),
        { onError: (error) => errors.push(error) },
        { signal: abort.signal },
      );
    } finally {
      clearTimeout(timeout);
    }
    expect(errors).toEqual([{
      code: 'INTERNAL_ERROR', requestId: 'request-invalid-event', retryable: false,
    }]);
  });
});
