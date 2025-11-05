export function buildDashboardHeaders(params: {
  role: string;
  actorId: string;
  studentId?: string | null;
}): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Role": params.role,
    "X-Actor-Id": params.actorId,
  };

  if (params.studentId) {
    headers["X-Student-Id"] = params.studentId;
  }

  return headers;
}
