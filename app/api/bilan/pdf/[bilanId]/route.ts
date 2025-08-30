// app/api/bilan/pdf/[bilanId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { pdf } from '@react-pdf/renderer';
import BilanPdf from '@/lib/pdf/BilanPdf';
import BilanPdfParent from '@/lib/pdf/BilanPdfParent';
import BilanPdfEleve from '@/lib/pdf/BilanPdfEleve';
import { toPdfData } from '@/lib/bilan/pdf-data-mapper';
import React from 'react';

import { rateLimit } from '@/lib/rate-limit';
import { getRateLimitConfig } from '@/lib/rate-limit.config';

export async function GET(req: NextRequest, { params }: { params: { bilanId: string } }) {
  try {
    const url = new URL(req.url);
    const variant = (url.searchParams.get('variant') || 'standard').toLowerCase();

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const conf = getRateLimitConfig('BILAN_PDF', { windowMs: 60_000, max: 5 });
    const rl = rateLimit(conf);
    const check = await rl(`bilan_pdf:${ip}`);
    if (!check.ok) return NextResponse.json({ error: 'Trop de requêtes, réessayez plus tard.' }, { status: 429 });

    const bilan = await prisma.bilan.findUnique({
      where: { id: params.bilanId },
      include: { student: { include: { user: true } } },
    });
    if (!bilan) return NextResponse.json({ error: 'Bilan introuvable' }, { status: 404 });

    const pdfData = toPdfData(bilan);

    let doc: React.ReactElement;
    switch (variant) {
      case 'parent':
        doc = React.createElement(BilanPdfParent, { data: pdfData });
        break;
      case 'eleve':
        doc = React.createElement(BilanPdfEleve, { data: pdfData });
        break;
      default:
        doc = React.createElement(BilanPdf, { data: pdfData });
    }

    const buffer = await pdf(doc).toBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename=bilan-${bilan.id}-${variant}.pdf`,
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur PDF' }, { status: 500 });
  }
}

