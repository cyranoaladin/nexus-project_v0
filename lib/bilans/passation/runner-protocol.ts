export type Confidence = 1 | 2 | 3 | 4;
export type SavedAnswer = Readonly<{ optionId: string | null; confidence: Confidence | null }>;
export type AttemptItem = Readonly<{
  id: string;
  prompt: string;
  options: readonly Readonly<{ id: string; label: string }>[];
  savedAnswer: SavedAnswer;
}>;
export type CanonicalAttemptDto = Readonly<{
  attemptId: string;
  pack: Readonly<{ slug: string; version: number; title: string }>;
  status: 'DRAFT';
  revision: number;
  expiresAt: string;
  items: readonly AttemptItem[];
}>;
export type PendingRunnerAnswer = Readonly<{
  itemId: string;
  optionId: string;
  confidence: Confidence;
}>;
export type RunnerFetch = (input: string, init?: RequestInit) => Promise<Response>;

export class RunnerProtocolError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly serverRevision: number | null = null,
  ) {
    super(code);
    this.name = 'RunnerProtocolError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseAttemptDto(value: unknown): CanonicalAttemptDto {
  if (
    !isRecord(value)
    || typeof value.attemptId !== 'string'
    || value.status !== 'DRAFT'
    || !Number.isSafeInteger(value.revision)
    || typeof value.expiresAt !== 'string'
    || !Array.isArray(value.items)
  ) throw new RunnerProtocolError(500, 'RUNNER_RESPONSE_INVALID');
  return value as CanonicalAttemptDto;
}

async function apiError(response: Response): Promise<RunnerProtocolError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    return new RunnerProtocolError(response.status, 'RUNNER_REQUEST_FAILED');
  }
  const error = isRecord(body) && isRecord(body.error) ? body.error : null;
  const code = error !== null && typeof error.code === 'string' ? error.code : 'RUNNER_REQUEST_FAILED';
  const serverRevision = error !== null
    && isRecord(error.details)
    && typeof error.details.serverRevision === 'number'
    ? error.details.serverRevision
    : null;
  return new RunnerProtocolError(response.status, code, serverRevision);
}

function key(kind: 'answer' | 'submit', attemptId: string, revision: number, suffix = ''): string {
  return `a87-${kind}-${attemptId}-${revision}-${suffix}`.slice(0, 180);
}

export async function loadCanonicalAttempt(
  attemptId: string,
  fetcher: RunnerFetch = fetch,
): Promise<CanonicalAttemptDto> {
  const response = await fetcher(`/api/bilans/attempts/${encodeURIComponent(attemptId)}`, {
    method: 'GET',
    cache: 'no-store',
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw await apiError(response);
  return parseAttemptDto(await response.json());
}

export async function saveCanonicalAnswer(
  input: Readonly<{
    attemptId: string;
    revision: number;
    answer: PendingRunnerAnswer;
  }>,
  fetcher: RunnerFetch = fetch,
): Promise<Readonly<{ revision: number; savedItemIds: readonly string[] }>> {
  const response = await fetcher(`/api/bilans/attempts/${encodeURIComponent(input.attemptId)}/answers`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': key('answer', input.attemptId, input.revision, `${input.answer.itemId}-${input.answer.optionId}-${input.answer.confidence}`),
    },
    body: JSON.stringify({ revision: input.revision, answers: [input.answer] }),
  });
  if (!response.ok) throw await apiError(response);
  const body = await response.json() as unknown;
  if (!isRecord(body) || typeof body.revision !== 'number' || !Array.isArray(body.savedItemIds)) {
    throw new RunnerProtocolError(500, 'RUNNER_SAVE_INVALID');
  }
  return { revision: body.revision, savedItemIds: body.savedItemIds.filter((id): id is string => typeof id === 'string') };
}

export async function submitCanonicalAttempt(
  input: Readonly<{ attemptId: string; revision: number }>,
  fetcher: RunnerFetch = fetch,
): Promise<Readonly<{ attemptId: string; status: 'SUBMITTED'; revision: number }>> {
  const response = await fetcher(`/api/bilans/attempts/${encodeURIComponent(input.attemptId)}/submit`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': key('submit', input.attemptId, input.revision),
    },
    body: JSON.stringify({ revision: input.revision }),
  });
  if (!response.ok) throw await apiError(response);
  const body = await response.json() as unknown;
  if (
    !isRecord(body)
    || typeof body.attemptId !== 'string'
    || body.status !== 'SUBMITTED'
    || typeof body.revision !== 'number'
  ) throw new RunnerProtocolError(500, 'RUNNER_SUBMIT_INVALID');
  return { attemptId: body.attemptId, status: 'SUBMITTED', revision: body.revision };
}
