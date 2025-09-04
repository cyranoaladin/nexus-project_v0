import { requireRole } from '@/lib/api/rbac';
import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const guard = await requireRole(req, ['ADMIN', 'ASSISTANTE']);
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
  const { paths } = await req.json();
  if (Array.isArray(paths)) paths.forEach((p: string) => revalidatePath(p));
  return NextResponse.json({ ok: true, paths: paths || [] });
}
