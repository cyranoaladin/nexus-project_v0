import type { Page } from '@playwright/test';

/** Test-only metadata observer; never reads a body, header, token or identity. */
export async function installAriaTransportProbe(page: Page) {
  const handle = await page.evaluateHandle(() => {
    const previousFetch = window.fetch;
    const state = { selected: false, headersReceived: false, signalAborted: false, fetchRejected: false };
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
        () => { state.headersReceived = true; },
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
