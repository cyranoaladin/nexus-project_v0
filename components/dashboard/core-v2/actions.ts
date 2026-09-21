'use client';

import { useState } from 'react';
import { type ApiFail, type ApiResult } from './api';

/**
 * One in-flight action at a time per section: disables the triggering
 * control (no double submit), surfaces the typed failure, and reports success
 * only on a 2xx envelope — never optimistically.
 *
 * `onStaleConflict` is a separate, opt-in callback for the 409 case (someone
 * else already changed the record): the failure message tells the operator
 * the displayed state was reloaded, so something must actually reload it.
 * It is deliberately NOT defaulted to `onSuccess` — several callers pass an
 * `onSuccess` that closes a dialog (e.g. "setOpen(false); await onDone()"),
 * and closing that dialog out from under an operator who is still reading
 * the error message would hide the very explanation this is supposed to
 * give. Pass the same plain refetch as both arguments only at a call site
 * with no such dialog to close.
 */
export function useAction(onSuccess?: () => void | Promise<void>, onStaleConflict?: () => void | Promise<void>) {
  const [pending, setPending] = useState<string | null>(null);
  const [failure, setFailure] = useState<ApiFail | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function run<T>(key: string, request: () => Promise<ApiResult<T>>, doneMessage: string): Promise<ApiResult<T> | null> {
    if (pending) return null;
    setPending(key);
    setFailure(null);
    setSuccess(null);
    try {
      const result = await request();
      if (result.ok) {
        setSuccess(doneMessage);
        await onSuccess?.();
      } else {
        setFailure(result);
        if (isStaleConflict(result)) await onStaleConflict?.();
      }
      return result;
    } finally {
      setPending(null);
    }
  }

  return { pending, failure, success, run, clear: () => { setFailure(null); setSuccess(null); } };
}

/** 409 CONFLICT after a stale read: the record changed underneath the operator. */
export function isStaleConflict(failure: ApiFail | null): boolean {
  return failure?.status === 409 && (failure.code === 'CONFLICT' || failure.code === 'INVALID_STATE');
}
