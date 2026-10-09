/** @jest-environment node */
import { createNativeResponseReader } from '@/lib/aria/transport/native-response-reader';

test('cancels both branches idempotently while an acknowledged write is blocked', async () => {
  const cancelled = jest.fn();
  const body = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array([1, 2, 3])); }, cancel: cancelled,
  });
  const transport = createNativeResponseReader(new Response(body));
  expect((await transport.reader.read()).value).toEqual(new Uint8Array([1, 2, 3]));
  const first = transport.cancel();
  expect(transport.cancel()).toBe(first);
  expect(await first).toBe(true);
  expect(cancelled).toHaveBeenCalledTimes(1);
  transport.release();
});

test('source failure cannot become successful drainage', async () => {
  const body = new ReadableStream<Uint8Array>({ pull(controller) { controller.error(new Error('synthetic source failure')); } });
  const transport = createNativeResponseReader(new Response(body));
  await expect(transport.reader.read()).rejects.toThrow('synthetic source failure');
  await expect(transport.finish()).rejects.toThrow('synthetic source failure');
  expect(await transport.cancel()).toBe(false);
  transport.release();
});

test('drainage is not complete until the parser acknowledges its final chunk', async () => {
  const body = new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(new Uint8Array([1])); controller.enqueue(new Uint8Array([2])); controller.close();
  } });
  const transport = createNativeResponseReader(new Response(body));
  let finished = false;
  const drainage = transport.finish().then(() => { finished = true; });
  const first = await transport.reader.read();
  expect(first.value).toEqual(new Uint8Array([1]));
  expect(finished).toBe(false);
  transport.acknowledge();
  const second = await transport.reader.read();
  expect(second.value).toEqual(new Uint8Array([2]));
  expect(finished).toBe(false);
  transport.acknowledge();
  expect((await transport.reader.read()).done).toBe(true);
  await drainage;
  expect(finished).toBe(true);
  transport.release();
});


test('a slow parser can cancel a large response before the discard branch reads the whole body', async () => {
  const totalChunks = 128;
  let pulled = 0;
  const cancelled = jest.fn();
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulled += 1;
      controller.enqueue(new Uint8Array(64 * 1024));
      if (pulled === totalChunks) controller.close();
    }, cancel: cancelled,
  });
  const transport = createNativeResponseReader(new Response(body));
  expect((await transport.reader.read()).value?.byteLength).toBe(64 * 1024);
  // No acknowledgement: the native sink cannot consume the complete response.
  expect(pulled).toBeLessThan(totalChunks);
  expect(await transport.cancel()).toBe(true);
  expect(pulled).toBeLessThan(totalChunks);
  expect(cancelled).toHaveBeenCalledTimes(1);
  transport.release();
});
