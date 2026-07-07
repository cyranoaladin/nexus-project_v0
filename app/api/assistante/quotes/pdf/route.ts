import { UserRole } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

import { isErrorResponse, requireAnyRole } from '@/lib/guards';
import { renderQuotePDF, type QuotePDFData } from '@/lib/quote/pdf';
import { guardRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const quoteInstallmentSchema = z.object({
  label: z.string().trim().min(1).max(120),
  amount: z.coerce.number().finite().nonnegative().max(1_000_000),
}).strict();

const quoteOfferSchema = z.object({
  label: z.string().trim().min(1).max(160),
  desc: z.string().trim().max(500),
  annualDisplay: z.string().trim().min(1).max(80),
  inc: z.array(z.string().trim().min(1).max(180)).max(20).default([]),
  ech: z.array(quoteInstallmentSchema).max(12).default([]),
}).strict();

const quoteAlternativeSchema = z.object({
  label: z.string().trim().min(1).max(160),
  desc: z.string().trim().max(500),
  annualDisplay: z.string().trim().min(1).max(80),
}).strict();

const quotePayloadSchema = z.object({
  quoteNumber: z.string().trim().min(1).max(80),
  generatedAt: z.string().trim().min(1).max(80),
  validUntil: z.string().trim().min(1).max(80),
  studentName: z.string().trim().min(1).max(160),
  parentName: z.string().trim().min(1).max(160),
  whatsapp: z.string().trim().max(80),
  email: z.string().trim().email().max(180),
  advisor: z.string().trim().max(160),
  level: z.string().trim().max(120),
  status: z.string().trim().max(120),
  establishment: z.string().trim().max(180),
  languages: z.string().trim().max(180),
  currentLevel: z.string().trim().max(180),
  specialites: z.array(z.string().trim().max(120)).max(10).default([]),
  options: z.array(z.string().trim().max(120)).max(10).default([]),
  modalite: z.string().trim().max(120),
  objectif: z.string().trim().max(500),
  budget: z.string().trim().max(120),
  mode: z.string().trim().max(120),
  reduction: z.string().trim().max(80),
  reductionLabels: z.array(z.string().trim().max(160)).max(10).default([]),
  hasDirectionOverride: z.boolean(),
  publicAnnual: z.coerce.number().finite().nonnegative().max(1_000_000).nullable().optional(),
  monthlyDisplay: z.string().trim().max(120).nullable().optional(),
  economie: z.coerce.number().finite().nonnegative().max(1_000_000).nullable().optional(),
  internalNotes: z.string().trim().max(1000).optional(),
  offer: quoteOfferSchema,
  alternatives: z.array(quoteAlternativeSchema).max(10).default([]),
}).strict();

function sanitizeFilenamePart(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'eleve';
}

export async function POST(request: NextRequest) {
  const sessionOrError = await requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE]);
  if (isErrorResponse(sessionOrError)) return sessionOrError;

  const blocked = guardRateLimit(request, { preset: 'expensive', keySuffix: 'quotes-pdf' });
  if (blocked) return blocked;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsedPayload = quotePayloadSchema.safeParse(payload);
  if (!parsedPayload.success) {
    return NextResponse.json({ error: 'Invalid quote payload' }, { status: 400 });
  }
  const quoteData = parsedPayload.data as QuotePDFData;

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
