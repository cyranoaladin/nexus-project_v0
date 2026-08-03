import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/auth';
import { buildStaffGroupPlanDocument, StaffGroupPlanError } from '@/lib/bilans/staff/group-plan-service';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (session?.user?.id === undefined || session.user.role === undefined) return new NextResponse(null, { status: 404 });
  const format = request.nextUrl.searchParams.get('format');
  if (format !== 'html' && format !== 'pdf') return NextResponse.json({ error: { code: 'GROUP_FORMAT_INVALID' } }, { status: 400 });
  try {
    const document = await buildStaffGroupPlanDocument({
      userId: session.user.id,
      role: session.user.role,
      attemptIds: request.nextUrl.searchParams.getAll('attemptId'),
      format,
    });
    const body = typeof document.body === 'string' ? document.body : new Uint8Array(document.body);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'content-type': document.contentType,
        'content-disposition': `inline; filename="${document.filename}"`,
        'cache-control': 'private, no-store',
      },
    });
  } catch (error) {
    if (error instanceof StaffGroupPlanError) {
      const status = error.code === 'NOT_FOUND' ? 404 : 400;
      return NextResponse.json({ error: { code: error.code } }, { status });
    }
    throw error;
  }
}
