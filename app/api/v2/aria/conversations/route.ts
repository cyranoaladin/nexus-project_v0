export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { loadCoreV2AriaStudentContext } from '@/lib/core-v2/aria/student-context';

const querySchema = z.object({ courseKey: z.string().min(1).optional(), cursor: z.string().min(1).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) }).strict();

function decodeCursor(value: string | undefined): { updatedAt: Date; id: string } | undefined {
  if (!value) return undefined;
  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8').split('|');
    if (decoded.length !== 2) return undefined;
    const updatedAt = new Date(decoded[0]!);
    if (Number.isNaN(updatedAt.getTime()) || !decoded[1]) return undefined;
    return { updatedAt, id: decoded[1] };
  } catch {
    return undefined;
  }
}

function encodeCursor(updatedAt: Date, id: string): string {
  return Buffer.from(`${updatedAt.toISOString()}|${id}`, 'utf8').toString('base64url');
}

export const GET = defineStaffRoute({
  query: querySchema,
  handler: async ({ client, ctx, query }) => {
    const student = await loadCoreV2AriaStudentContext(client, ctx);
    const cursor = decodeCursor(query?.cursor);
    const rows = await client.ariaConversationCoreV2.findMany({
      where: {
        studentId: student.studentId,
        ...(query?.courseKey ? { courseKey: query.courseKey } : {}),
        ...(cursor ? { OR: [{ updatedAt: { lt: cursor.updatedAt } }, { updatedAt: cursor.updatedAt, id: { lt: cursor.id } }] } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: (query?.limit ?? 20) + 1,
      select: {
        id: true,
        courseKey: true,
        updatedAt: true,
        turns: { where: { status: { in: ['PENDING', 'RUNNING'] } }, orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, clientRequestId: true, status: true, pedagogicalMode: true } },
      },
    });
    const hasMore = rows.length > (query?.limit ?? 20);
    const page = rows.slice(0, query?.limit ?? 20);
    const next = hasMore ? page[page.length - 1] : undefined;
    return {
      data: {
        items: page.map((row) => ({ id: row.id, courseKey: row.courseKey, contextState: 'ACTIVE' as const, resumable: true as const, activeTurn: row.turns[0] ?? null })),
        nextCursor: next ? encodeCursor(next.updatedAt, next.id) : null,
      },
    };
  },
});
