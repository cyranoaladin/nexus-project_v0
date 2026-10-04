/** @jest-environment node */
import { formatAriaSSEEvent, parseAriaSSEResponse } from '@/lib/aria/transport/sse-parser';
import type { AriaSSEEvent } from '@/lib/aria/transport/contracts';

const start: AriaSSEEvent = { event: 'start', data: {
  turnId: 'synthetic-turn', conversationId: 'synthetic-conversation', messageId: 'synthetic-message',
  courseKey: 'eds-nsi-premiere', status: 'RUNNING', disposition: 'EXECUTED',
} };
const done: AriaSSEEvent = { event: 'done', data: {
  turnId: 'synthetic-turn', messageId: 'synthetic-message', status: 'COMPLETED', fullText: 'Réponse synthétique.',
} };
const error: AriaSSEEvent = { event: 'error', data: {
  code: 'RAG_UNAVAILABLE', requestId: 'synthetic-request', retryable: true,
} };

test.each([done, error])('publishes $event only after the native response body reaches EOF', async terminal => {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let startSeen!: () => void;
  const started = new Promise<void>(resolve => { startSeen = resolve; });
  const cancelled = jest.fn();
  const body = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value;
      controller.enqueue(new TextEncoder().encode(formatAriaSSEEvent(start) + formatAriaSSEEvent(terminal)));
    },
    cancel: cancelled,
  });
  const onDone = jest.fn();
  const onError = jest.fn();
  const parsing = parseAriaSSEResponse(new Response(body, { headers: { 'content-type': 'text/event-stream' } }),
    { onStart: startSeen, onDone, onError });
  try {
    await started;
    expect(onDone).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(cancelled).not.toHaveBeenCalled();
  } finally {
    controller.close();
    await parsing;
  }
  expect(terminal.event === 'done' ? onDone : onError).toHaveBeenCalledTimes(1);
  expect(cancelled).not.toHaveBeenCalled();
});

test('does not announce successful completion when trailing frames invalidate the stream', async () => {
  const onDone = jest.fn();
  const wire = formatAriaSSEEvent(start) + formatAriaSSEEvent(done)
    + formatAriaSSEEvent({ event: 'delta', data: { text: 'invalid trailing data' } });
  await expect(parseAriaSSEResponse(new Response(wire, { headers: { 'content-type': 'text/event-stream' } }),
    { onDone })).rejects.toMatchObject({ code: 'EVENT_AFTER_TERMINAL' });
  expect(onDone).not.toHaveBeenCalled();
});


test('bounds terminal drainage and cancels a transport which never sends EOF', async () => {
  jest.useFakeTimers();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let startSeen!: () => void;
  const started = new Promise<void>(resolve => { startSeen = resolve; });
  const cancelled = jest.fn();
  const onDone = jest.fn();
  const onProtocolError = jest.fn();
  const body = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value;
      controller.enqueue(new TextEncoder().encode(formatAriaSSEEvent(start) + formatAriaSSEEvent(done)));
    }, cancel: cancelled,
  });
  const parsing = parseAriaSSEResponse(new Response(body, { headers: { 'content-type': 'text/event-stream' } }),
    { onStart: startSeen, onDone, onProtocolError });
  const observed = parsing.then(() => ({ ok: true }), (error: unknown) => ({ ok: false, error }));
  try {
    await started;
    await jest.advanceTimersByTimeAsync(5_000);
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(await observed).toMatchObject({ ok: false, error: { code: 'TERMINAL_DRAIN_TIMEOUT' } });
    expect(onProtocolError).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  } finally {
    if (!cancelled.mock.calls.length) controller.close();
    await observed;
    jest.useRealTimers();
  }
});

test.each(['abort', 'network-error'])('does not publish a terminal after %s during drainage', async kind => {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let startSeen!: () => void;
  const started = new Promise<void>(resolve => { startSeen = resolve; });
  const cancelled = jest.fn();
  const onDone = jest.fn();
  const onProtocolError = jest.fn();
  const abort = new AbortController();
  const body = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value;
      controller.enqueue(new TextEncoder().encode(formatAriaSSEEvent(start) + formatAriaSSEEvent(done)));
    }, cancel: cancelled,
  });
  const parsing = parseAriaSSEResponse(new Response(body, { headers: { 'content-type': 'text/event-stream' } }),
    { onStart: startSeen, onDone, onProtocolError }, { signal: abort.signal });
  const observed = parsing.then(() => ({ ok: true }), (error: unknown) => ({ ok: false, error }));
  await started;
  if (kind === 'abort') abort.abort();
  else controller.error(new Error('synthetic stream failure'));
  expect(await observed).toMatchObject({ ok: false, error: { code: kind === 'abort' ? 'ABORTED' : 'INVALID_EVENT' } });
  expect(onDone).not.toHaveBeenCalled();
  expect(onProtocolError).toHaveBeenCalledTimes(1);
  expect(cancelled).toHaveBeenCalledTimes(kind === 'abort' ? 1 : 0);
});

test('preserves valid event parsing when a frame also contains SSE comments and an event id', async () => {
  const onStart = jest.fn();
  const onDone = jest.fn();
  const wire = ': synthetic keepalive\nid: synthetic-event-id\n' + formatAriaSSEEvent(start) + formatAriaSSEEvent(done);
  await parseAriaSSEResponse(new Response(wire, { headers: { 'content-type': 'text/event-stream' } }), { onStart, onDone });
  expect(onStart).toHaveBeenCalledWith(start.data);
  expect(onDone).toHaveBeenCalledWith(done.data);
  expect(onDone).toHaveBeenCalledTimes(1);
});


test.each(['invalid-json', 'consumer-failure'])('cancels an open native transport after %s without publishing completion', async kind => {
  const cancelled = jest.fn();
  const onDone = jest.fn();
  const wire = formatAriaSSEEvent(start) + (kind === 'invalid-json'
    ? 'event: delta\ndata: {broken\n\n'
    : formatAriaSSEEvent({ event: 'delta', data: { text: 'synthetic delta' } }));
  const body = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new TextEncoder().encode(wire)); },
    cancel: cancelled,
  });
  await expect(parseAriaSSEResponse(new Response(body, { headers: { 'content-type': 'text/event-stream' } }), {
    onDone, onDelta() { if (kind === 'consumer-failure') throw new Error('synthetic callback failure'); },
  })).rejects.toMatchObject({ code: kind === 'invalid-json' ? 'INVALID_JSON' : 'INVALID_EVENT' });
  expect(onDone).not.toHaveBeenCalled();
  expect(cancelled).toHaveBeenCalledTimes(1);
});
