import type { AriaConversationMessageRole, AriaConversationTurnStatus } from '@/lib/core-v2/client';

export type CoreV2HistoryMessageStatus = 'PENDING' | 'STREAMING' | 'COMPLETED' | 'CANCELLED' | 'ERROR';

export function projectCoreV2MessageStatus(
  role: AriaConversationMessageRole,
  turnStatus: AriaConversationTurnStatus,
): CoreV2HistoryMessageStatus {
  if (role === 'USER') return 'COMPLETED';
  switch (turnStatus) {
    case 'PENDING': return 'PENDING';
    case 'RUNNING': return 'STREAMING';
    case 'COMPLETED': return 'COMPLETED';
    case 'CANCELLED': return 'CANCELLED';
    case 'ERROR': return 'ERROR';
    default: return 'ERROR';
  }
}

export function encodeCoreV2HistoryCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id }), 'utf8').toString('base64url');
}

export function decodeCoreV2HistoryCursor(value: string | undefined): { createdAt: Date; id: string } | undefined {
  if (!value) return undefined;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
    const cursor = parsed as { createdAt?: unknown; id?: unknown };
    if (typeof cursor.createdAt !== 'string' || typeof cursor.id !== 'string' || cursor.id.length === 0) return undefined;
    const createdAt = new Date(cursor.createdAt);
    return Number.isNaN(createdAt.getTime()) ? undefined : { createdAt, id: cursor.id };
  } catch {
    return undefined;
  }
}
