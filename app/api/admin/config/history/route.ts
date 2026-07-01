/**
 * GET /api/admin/config/history — Full audit trail of config changes
 *
 * Guard: ADMIN only.
 * Reads from business_config_audit (append-only, one row per change).
 */
import { NextResponse } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const auth = await requireRole('ADMIN');
  if (isErrorResponse(auth)) return auth;

  const entries = await prisma.businessConfigAudit.findMany({
    orderBy: { changedAt: 'desc' },
    take: 200,
    select: {
      id: true,
      namespace: true,
      key: true,
      oldValue: true,
      newValue: true,
      version: true,
      changedBy: true,
      changedAt: true,
    },
  });

  return NextResponse.json({ entries });
}
