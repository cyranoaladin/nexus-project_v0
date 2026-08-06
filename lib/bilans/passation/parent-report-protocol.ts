export type ParentReportFetcher = (input: string, init?: RequestInit) => Promise<Response>;

export type ParentCanonicalReportSummary = Readonly<{
  attemptId: string;
  level: string;
  subject: string;
  title: string;
  status: string;
  updatedAt: string;
  reportAvailable: boolean;
}>;

export type ParentCanonicalReports = Readonly<{
  studentId: string;
  bilans: readonly ParentCanonicalReportSummary[];
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isSummary(value: unknown): value is ParentCanonicalReportSummary {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'attemptId', 'level', 'subject', 'title', 'status', 'updatedAt', 'reportAvailable',
  ])) return false;
  return typeof value.attemptId === 'string'
    && typeof value.level === 'string'
    && typeof value.subject === 'string'
    && typeof value.title === 'string'
    && typeof value.status === 'string'
    && typeof value.updatedAt === 'string'
    && !Number.isNaN(Date.parse(value.updatedAt))
    && typeof value.reportAvailable === 'boolean';
}

export async function loadParentCanonicalReports(
  studentId: string,
  fetcher: ParentReportFetcher = fetch,
): Promise<ParentCanonicalReports> {
  const response = await fetcher(
    `/api/parent/children/${encodeURIComponent(studentId)}/bilans`,
    { cache: 'no-store' },
  );
  if (!response.ok) throw new Error('PARENT_CANONICAL_REPORTS_FAILED');
  const body: unknown = await response.json();
  if (
    !isRecord(body)
    || !hasOnlyKeys(body, ['studentId', 'bilans'])
    || body.studentId !== studentId
    || !Array.isArray(body.bilans)
    || !body.bilans.every(isSummary)
  ) throw new Error('PARENT_CANONICAL_REPORTS_INVALID_RESPONSE');
  return body as ParentCanonicalReports;
}

export function parentCanonicalReportUrl(
  studentId: string,
  attemptId: string,
  format: 'html' | 'pdf',
): string {
  return `/api/parent/children/${encodeURIComponent(studentId)}/bilans/${encodeURIComponent(attemptId)}/report?format=${format}`;
}
