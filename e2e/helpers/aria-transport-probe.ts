import type { Page } from '@playwright/test';

/** Test-only metadata observer; never initiates a body read or inspects bytes, headers, tokens or identities. */
export async function installAriaTransportProbe(page: Page) {
  const handle = await page.evaluateHandle(() => {
    const previousFetch = window.fetch;
    const previousGetReader = ReadableStream.prototype.getReader;
    const previousRead = ReadableStreamDefaultReader.prototype.read;
    const readers = new WeakSet<ReadableStreamDefaultReader<unknown>>();
    let selectedBody: ReadableStream<Uint8Array> | null = null;
    const state = { selected: false, headersReceived: false, signalAborted: false, fetchRejected: false,
      bodyEof: false, bodyReadFailed: false };
    const observedGetReader: typeof previousGetReader = function (this: ReadableStream<unknown>, ...args) {
      const reader = Reflect.apply(previousGetReader, this, args) as ReadableStreamDefaultReader<unknown> | ReadableStreamBYOBReader;
      if (this === selectedBody && reader instanceof ReadableStreamDefaultReader) readers.add(reader);
      return reader;
    } as typeof previousGetReader;
    const observedRead: typeof previousRead = function (this: ReadableStreamDefaultReader<unknown>, ...args) {
      const pending = previousRead.apply(this, args);
      if (readers.has(this)) void pending.then(
        result => { if (result.done) state.bodyEof = true; },
        () => { state.bodyReadFailed = true; },
      );
      return pending;
    };
    ReadableStream.prototype.getReader = observedGetReader;
    ReadableStreamDefaultReader.prototype.read = observedRead;
    let signal: AbortSignal | null | undefined;
    const onAbort = () => { state.signalAborted = true; };
    const observedFetch: typeof fetch = (input, init) => {
      // Return the original promise: observation never delays a business read.
      const pending = previousFetch.call(window, input, init);
      if (state.selected) return pending;
      let url: URL;
      try {
        url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href);
      } catch { return pending; }
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
      if (method.toUpperCase() !== 'POST' || url.origin !== window.location.origin || url.pathname !== '/api/aria/chat') return pending;
      state.selected = true;
      signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
      if (signal?.aborted) state.signalAborted = true;
      else signal?.addEventListener('abort', onAbort, { once: true });
      void pending.then(
        response => { state.headersReceived = true; selectedBody = response.body; },
        () => { state.fetchRejected = true; },
      );
      return pending;
    };
    window.fetch = observedFetch;
    return {
      snapshot() {
        const dialog = document.querySelector('[role="dialog"][aria-label="Assistant pédagogique ARIA"]');
        const composer = dialog?.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message à ARIA"]');
        return { ...state, dialogPresent: !!dialog, composerEnabled: !!composer && !composer.disabled, alertPresent: !!dialog?.querySelector('[role="alert"]') };
      },
      dispose() {
        signal?.removeEventListener('abort', onAbort);
        if (window.fetch === observedFetch) window.fetch = previousFetch;
        if (ReadableStream.prototype.getReader === observedGetReader) ReadableStream.prototype.getReader = previousGetReader;
        if (ReadableStreamDefaultReader.prototype.read === observedRead) ReadableStreamDefaultReader.prototype.read = previousRead;
      },
    };
  });
  return {
    snapshot: () => handle.evaluate(probe => probe.snapshot()),
    async dispose() {
      try { await handle.evaluate(probe => probe.dispose()); }
      finally { await handle.dispose(); }
    },
  };
}
