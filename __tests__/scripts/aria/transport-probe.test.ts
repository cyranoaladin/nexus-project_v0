/** @jest-environment node */
import type { Page } from '@playwright/test';
import { installAriaTransportProbe } from '../../../e2e/helpers/aria-transport-probe';

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
const originalReader = ReadableStream.prototype.getReader;
const originalRead = ReadableStreamDefaultReader.prototype.read;
const page = {
  evaluateHandle: async (evaluate: () => unknown) => {
    const probe = evaluate();
    return {
      evaluate: async (inspect: (value: unknown) => unknown) => inspect(probe),
      dispose: async () => {},
    };
  },
} as unknown as Page;

afterEach(() => {
  ReadableStream.prototype.getReader = originalReader;
  ReadableStreamDefaultReader.prototype.read = originalRead;
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
  else Reflect.deleteProperty(globalThis, 'document');
});

function configure(response: Response) {
  const pending = Promise.resolve(response);
  const fetch = jest.fn(() => pending);
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    fetch, location: { href: 'http://localhost:3000/' , origin: 'http://localhost:3000' },
  } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { querySelector: () => null } });
  return { fetch, pending };
}

it('observes application EOF without initiating any read and preserves the fetch promise', async () => {
  const response = new Response(new ReadableStream({ start(controller) { controller.close(); } }));
  const { pending } = configure(response);
  const probe = await installAriaTransportProbe(page);
  expect(window.fetch('/api/aria/chat', { method: 'POST' })).toBe(pending);
  await pending;
  expect((await probe.snapshot()).bodyEof).toBe(false);
  const reader = response.body!.getReader();
  expect(await reader.read()).toEqual({ done: true, value: undefined });
  expect(await probe.snapshot()).toMatchObject({ bodyEof: true, bodyReadFailed: false });
  await probe.dispose();
  expect(ReadableStream.prototype.getReader).toBe(originalReader);
  expect(ReadableStreamDefaultReader.prototype.read).toBe(originalRead);
});

it('observes an application read rejection without swallowing or replacing it', async () => {
  const rejection = new Error('SYNTHETIC_READ_FAILURE');
  const response = new Response(new ReadableStream({ start(controller) { controller.error(rejection); } }));
  const { pending } = configure(response);
  const probe = await installAriaTransportProbe(page);
  window.fetch('/api/aria/chat', { method: 'POST' });
  await pending;
  await expect(response.body!.getReader().read()).rejects.toBe(rejection);
  expect(await probe.snapshot()).toMatchObject({ bodyEof: false, bodyReadFailed: true });
  await probe.dispose();
});

it('does not attribute an unrelated response body to ARIA', async () => {
  const response = new Response('unrelated synthetic response');
  const { pending } = configure(response);
  const probe = await installAriaTransportProbe(page);
  window.fetch('/api/synthetic-other', { method: 'POST' });
  await pending;
  const reader = response.body!.getReader();
  await reader.read(); await reader.read();
  expect(await probe.snapshot()).toMatchObject({ selected: false, bodyEof: false, bodyReadFailed: false });
  await probe.dispose();
});
