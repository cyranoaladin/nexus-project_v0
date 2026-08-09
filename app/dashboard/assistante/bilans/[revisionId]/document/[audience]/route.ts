import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/auth';
import {
  renderPendingReportPdf,
  StaffReviewError,
} from '@/lib/bilans/staff/review-service';
import type { ReportAudience } from '@/lib/bilans/render/profile-copy';

const REVIEW_AUDIENCES = new Set<ReportAudience>(['ELEVE', 'PARENTS', 'NEXUS']);

type RouteContext = Readonly<{
  params: Promise<Readonly<{ revisionId: string; audience: string }>>;
}>;

function privateResponse(body: BodyInit | null, init: ResponseInit): NextResponse {
  const headers = new Headers(init.headers);
  headers.set('cache-control', 'private, no-store');
  return new NextResponse(body, { ...init, headers });
}

function safeFilename(filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
  return safe.length > 0 ? safe : 'bilan-nexus.pdf';
}

export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const session = await auth();
  if (session?.user?.id === undefined || session.user.role !== 'ASSISTANTE') {
    return privateResponse(null, { status: 404 });
  }

  const { revisionId, audience: rawAudience } = await context.params;
  if (!REVIEW_AUDIENCES.has(rawAudience as ReportAudience)) {
    return privateResponse(null, { status: 404 });
  }

  try {
    const document = await renderPendingReportPdf({
      userId: session.user.id,
      role: session.user.role,
      revisionId,
      audience: rawAudience as ReportAudience,
    });
    const disposition = request.nextUrl.searchParams.get('download') === '1'
      ? 'attachment'
      : 'inline';
    return privateResponse(new Uint8Array(document.pdf), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `${disposition}; filename="${safeFilename(document.filename)}"`,
      },
    });
  } catch (error) {
    if (error instanceof StaffReviewError) {
      const status = error.code === 'REPORT_PDF_UNAVAILABLE' ? 409 : 404;
      return privateResponse(JSON.stringify({ error: { code: error.code } }), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw error;
  }
}
