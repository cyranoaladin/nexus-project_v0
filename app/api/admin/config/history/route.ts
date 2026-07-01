/**
 * GET /api/admin/config/history — Config change history
 *
 * Guard: ADMIN only
 * Returns all entries ordered by updatedAt desc (audit trail).
 */
import { NextResponse } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const auth = await requireRole('ADMIN');
  if (isErrorResponse(auth)) return auth;

  const entries = await prisma.businessConfig.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      namespace: true,
      key: true,
      value: true,
      previousValue: true,
      version: true,
      schemaVersion: true,
      updatedBy: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ entries });
}
