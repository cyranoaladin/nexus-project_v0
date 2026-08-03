export type PilotFetcher = (input: string, init?: RequestInit) => Promise<Response>;

type CreatedAttempt = Readonly<{
  attemptId: string;
  status: string;
  startedAt: string;
  expiresAt: string;
}>;

export type CanonicalReportStatus = Readonly<{
  attemptId: string;
  status: string;
  reportStatus: string | null;
}>;

async function jsonResponse(response: Response, code: string): Promise<Record<string, unknown>> {
  if (!response.ok) throw new Error(code);
  const value: unknown = await response.json();
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

export async function createCanonicalAttempt(
  packSlug: string,
  idempotencyKey: string,
  fetcher: PilotFetcher = fetch,
): Promise<CreatedAttempt> {
  const body = await jsonResponse(await fetcher('/api/bilans/attempts', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
    body: JSON.stringify({ packSlug }),
  }), 'CANONICAL_ATTEMPT_CREATE_FAILED');
  if (
    typeof body.attemptId !== 'string'
    || typeof body.status !== 'string'
    || typeof body.startedAt !== 'string'
    || typeof body.expiresAt !== 'string'
  ) throw new Error('CANONICAL_ATTEMPT_CREATE_INVALID_RESPONSE');
  return body as CreatedAttempt;
}

export async function loadCanonicalReportStatus(
  attemptId: string,
  fetcher: PilotFetcher = fetch,
): Promise<CanonicalReportStatus> {
  const body = await jsonResponse(
    await fetcher(`/api/bilans/attempts/${encodeURIComponent(attemptId)}/status`, { cache: 'no-store' }),
    'CANONICAL_REPORT_STATUS_FAILED',
  );
  if (
    typeof body.attemptId !== 'string'
    || typeof body.status !== 'string'
    || (body.reportStatus !== null && typeof body.reportStatus !== 'string')
  ) throw new Error('CANONICAL_REPORT_STATUS_INVALID_RESPONSE');
  return body as CanonicalReportStatus;
}

export function canonicalReportUrl(attemptId: string, format: 'html' | 'pdf'): string {
  return `/api/bilans/attempts/${encodeURIComponent(attemptId)}/report?format=${format}`;
}
