export const CANDIDATE_IDENTITY_TIMEOUT_MS = 10_000;

export type CandidateIdentityRequestErrorCode = 'TIMEOUT' | 'ABORTED' | 'NETWORK';

export class CandidateIdentityRequestError extends Error {
  constructor(
    public readonly code: CandidateIdentityRequestErrorCode,
    options?: { cause?: unknown },
  ) {
    super(code, options);
    this.name = 'CandidateIdentityRequestError';
  }
}

interface RequestCandidateIdentityOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface CandidateIdentityHttpResult {
  ok: boolean;
  status: number;
  payload: unknown;
}

export async function requestCandidateIdentity(
  studentId: string,
  options: RequestCandidateIdentityOptions = {},
): Promise<CandidateIdentityHttpResult> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? CANDIDATE_IDENTITY_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  let timedOut = false;

  const abortFromCaller = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener('abort', abortFromCaller, { once: true });

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl('/api/assistante/candidat-individuel/identity/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, payload };
  } catch (cause) {
    if (timedOut) throw new CandidateIdentityRequestError('TIMEOUT', { cause });
    if (controller.signal.aborted) throw new CandidateIdentityRequestError('ABORTED', { cause });
    throw new CandidateIdentityRequestError('NETWORK', { cause });
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
}
