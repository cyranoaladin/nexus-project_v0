import { UserRole } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

import { isErrorResponse, requireAnyRole } from '@/lib/guards';
import { renderQuotePDF, type QuotePDFData } from '@/lib/quote/pdf';

export const dynamic = 'force-dynamic';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeFilenamePart(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'eleve';
}

function validateQuotePayload(value: unknown): QuotePDFData | NextResponse {
  if (!isRecord(value) || !isRecord(value.offer)) {
    return NextResponse.json({ error: 'Invalid quote payload' }, { status: 400 });
  }

  const required = ['quoteNumber', 'studentName', 'parentName', 'offer'];
  const missing = required.filter(key => value[key] == null || value[key] === '');
  if (missing.length > 0) {
    return NextResponse.json(
      { error: 'Invalid quote payload', missing },
      { status: 400 }
    );
  }

  return value as unknown as QuotePDFData;
}

export async function POST(request: NextRequest) {
  const sessionOrError = await requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE]);
  if (isErrorResponse(sessionOrError)) return sessionOrError;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const quoteData = validateQuotePayload(payload);
  if (isErrorResponse(quoteData)) return quoteData;

  const pdfBuffer = await renderQuotePDF(quoteData);
  const student = sanitizeFilenamePart(quoteData.studentName);
  const quoteNumber = sanitizeFilenamePart(quoteData.quoteNumber);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Devis-Nexus-${student}-${quoteNumber}.pdf"`,
      'Content-Length': String(pdfBuffer.length),
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  });
}
