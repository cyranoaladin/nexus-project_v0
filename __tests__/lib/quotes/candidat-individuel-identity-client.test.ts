import {
  CandidateIdentityRequestError,
  requestCandidateIdentity,
} from '@/lib/quotes/candidat-individuel-identity.client';

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('requestCandidateIdentity', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('retourne la réponse autoritative sans modifier le payload', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response({ success: true, student: { studentId: 'student-1' } }));
    await expect(requestCandidateIdentity('student-1', { fetchImpl, timeoutMs: 100 })).resolves.toMatchObject({
      ok: true,
      status: 200,
      payload: { success: true, student: { studentId: 'student-1' } },
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/assistante/candidat-individuel/identity/resolve',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ studentId: 'student-1' }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  test('interrompt un appel trop long et le classe TIMEOUT', async () => {
    jest.useFakeTimers();
    const fetchImpl = jest.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const pending = requestCandidateIdentity('student-1', { fetchImpl, timeoutMs: 50 });
    const rejection = expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });
    await jest.advanceTimersByTimeAsync(51);
    await rejection;
  });

  test('respecte un abort externe et le classe ABORTED', async () => {
    const controller = new AbortController();
    const fetchImpl = jest.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const pending = requestCandidateIdentity('student-1', { fetchImpl, timeoutMs: 1000, signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toEqual(expect.objectContaining({ code: 'ABORTED' }));
  });

  test('permet un succès après un timeout et un retry explicite', async () => {
    jest.useFakeTimers();
    const firstFetch = jest.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const first = requestCandidateIdentity('student-1', { fetchImpl: firstFetch, timeoutMs: 10 });
    const firstRejection = expect(first).rejects.toBeInstanceOf(CandidateIdentityRequestError);
    await jest.advanceTimersByTimeAsync(11);
    await firstRejection;

    const retryFetch = jest.fn().mockResolvedValue(response({ success: true }));
    await expect(requestCandidateIdentity('student-1', { fetchImpl: retryFetch, timeoutMs: 10 })).resolves.toEqual({
      ok: true,
      status: 200,
      payload: { success: true },
    });
  });
});
