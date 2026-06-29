import { serializeError } from '@/lib/utils/serialize-error';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { getRegisteredSlugs, getOfficialPdf } from '@/lib/programme/official-pdfs';
import { isOfficialPdfAllowedFor } from '@/lib/programme/access';
import { prisma } from '@/lib/prisma';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ slug: string }> }
) {
  const { slug } = await props.params;
  const sessionOrError = await requireRole(UserRole.ELEVE);
  if (isErrorResponse(sessionOrError)) return sessionOrError;

  const session = sessionOrError;

  // Load student profile for track/level gating
  const student = await prisma.student.findUnique({
    where: { userId: session.user.id },
    select: {
      gradeLevel: true,
      academicTrack: true,
    },
  });

  if (!student) {
    return NextResponse.json(
      { error: 'Student profile not found' },
      { status: 404 }
    );
  }

  try {
    // Validate slug against whitelist
    const registeredSlugs = getRegisteredSlugs();
    if (!registeredSlugs.has(slug)) {
      return NextResponse.json(
        { error: 'PDF not found' },
        { status: 404 }
      );
    }

    // Get PDF metadata
    const pdfMetadata = getOfficialPdf(slug);
    if (!pdfMetadata) {
      return NextResponse.json(
        { error: 'PDF not found' },
        { status: 404 }
      );
    }

    // Track/Level gating - deny access if student profile doesn't match PDF
    if (!isOfficialPdfAllowedFor(pdfMetadata, student)) {
      return NextResponse.json(
        { error: 'FORBIDDEN_FOR_PROFILE' },
        { status: 403 }
      );
    }

    // Build absolute file path
    const filePath = join(
      process.cwd(),
      pdfMetadata.baseDir,
      pdfMetadata.filename
    );

    // Check if file exists and get its stats
    let fileStats;
    try {
      fileStats = await stat(filePath);
    } catch (error) {
      console.error(`[official-pdf] File not found: ${filePath}`, serializeError(error));
      return NextResponse.json(
        { error: 'PDF file not found on disk' },
        { status: 404 }
      );
    }

    // Read file content
    const fileBuffer = await readFile(filePath);

    // Set appropriate headers
    const headers = {
      'Content-Type': 'application/pdf',
      'Content-Length': fileBuffer.length.toString(),
      'Cache-Control': 'private, max-age=86400, no-transform', // 24 hours private cache, no proxy transformation
      'Content-Disposition': `inline; filename="${pdfMetadata.filename}"`,
      'X-PDF-Slug': slug,
      'X-PDF-Title': pdfMetadata.title,
      'X-PDF-Category': pdfMetadata.category,
      'X-PDF-Level': pdfMetadata.level,
      'X-PDF-Track': pdfMetadata.track,
      'X-PDF-Source': pdfMetadata.source,
    };

    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error(`[official-pdf] Error serving PDF for slug: ${slug}`, serializeError(error));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
