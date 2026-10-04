/** Keep the native fetch consumer alive through EOF while parsing progressively.
 * The discard branch waits for each parser acknowledgement: it never accumulates
 * a second response body. Both branches are cancelled together on every failure.
 */
export function createNativeResponseReader(response: Response) {
  if (!response.body) throw new Error('ARIA_SSE_BODY_MISSING');
  const cloned = response.clone();
  if (!cloned.body) throw new Error('ARIA_SSE_BODY_MISSING');
  const nativeBody = response.body;
  const reader = cloned.body.getReader();
  const abort = new AbortController();
  let consumed = 0;
  let written = 0;
  let pending: { resolve: () => void; reject: (reason: unknown) => void } | undefined;
  let cancellation: Promise<boolean> | undefined;
  const drained = nativeBody.pipeTo(new WritableStream<Uint8Array>({
    write() {
      if (abort.signal.aborted) return Promise.reject(abort.signal.reason);
      written += 1;
      if (consumed >= written) return;
      return new Promise<void>((resolve, reject) => { pending = { resolve, reject }; });
    },
  }), { signal: abort.signal, preventCancel: true }).then(
    () => ({ ok: true as const }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  return {
    reader,
    acknowledge() {
      consumed += 1;
      if (pending && consumed >= written) {
        pending.resolve();
        pending = undefined;
      }
    },
    async finish() {
      const result = await drained;
      if (!result.ok) throw result.error;
    },
    cancel(): Promise<boolean> {
      if (cancellation) return cancellation;
      const reason = new DOMException('ARIA_SSE_TRANSPORT_CANCELLED', 'AbortError');
      // Unblock the sink first: aborting pipeTo alone waits for an active write.
      pending?.reject(reason);
      pending = undefined;
      abort.abort(reason);
      cancellation = Promise.allSettled([reader.cancel(reason), drained.then(() => nativeBody.cancel(reason))]).then(results =>
        results[0].status === 'fulfilled' && results[1].status === 'fulfilled');
      return cancellation;
    },
    release() { reader.releaseLock(); },
  };
}
