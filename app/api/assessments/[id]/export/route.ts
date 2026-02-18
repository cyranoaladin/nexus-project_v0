/**
 * GET /api/assessments/[id]/export
 *
 * Server-side PDF generation for assessment results.
 * Uses @react-pdf/renderer to produce an institutional-quality PDF.
 *
 * Returns: application/pdf stream
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { renderToBuffer } from '@react-pdf/renderer';
import { AssessmentPDFDocument, type AssessmentPDFData } from '@/lib/pdf/assessment-template';
import { getSSNLabel, computePercentile } from '@/lib/core/statistics/normalize';
import React from 'react';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch assessment
    const assessment = await prisma.assessment.findUnique({
      where: { id },
      select: {
        id: true,
        subject: true,
        grade: true,
        studentName: true,
        studentEmail: true,
        globalScore: true,
        confidenceIndex: true,
        scoringResult: true,
        status: true,
        createdAt: true,
      },
    });

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    if (assessment.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Assessment not yet completed', status: assessment.status },
        { status: 400 }
      );
    }

    // Fetch SSN via raw query
    const ssnRows = await prisma.$queryRawUnsafe<{ ssn: number | null }[]>(
      `SELECT "ssn" FROM "assessments" WHERE "id" = $1`,
      id
    );
    const ssn = ssnRows[0]?.ssn ?? null;

    // Fetch domain scores
    let domainScores: { domain: string; score: number }[] = [];
    try {
      domainScores = await prisma.$queryRawUnsafe<{ domain: string; score: number }[]>(
        `SELECT "domain", "score" FROM "domain_scores" WHERE "assessmentId" = $1 ORDER BY "score" DESC`,
        id
      );
    } catch {
      // Graceful fallback
    }

    // Fetch skill scores
    let skillScores: { skillTag: string; score: number }[] = [];
    try {
      skillScores = await prisma.$queryRawUnsafe<{ skillTag: string; score: number }[]>(
        `SELECT "skillTag", "score" FROM "skill_scores" WHERE "assessmentId" = $1 ORDER BY "score" ASC`,
        id
      );
    } catch {
      // Graceful fallback
    }

    // Compute percentile
    let percentile: number | null = null;
    if (ssn !== null) {
      try {
        const cohortSSNs = await prisma.$queryRawUnsafe<{ ssn: number }[]>(
          `SELECT "ssn" FROM "assessments" WHERE "subject" = $1 AND "ssn" IS NOT NULL`,
          assessment.subject
        );
        percentile = computePercentile(ssn, cohortSSNs.map((r) => r.ssn));
      } catch {
        // Graceful fallback
      }
    }

    // Extract strengths, weaknesses, recommendations from scoringResult
    const scoringResult = assessment.scoringResult as Record<string, unknown> | null;
    const strengths = Array.isArray(scoringResult?.strengths)
      ? (scoringResult.strengths as string[])
      : [];
    const weaknesses = Array.isArray(scoringResult?.weaknesses)
      ? (scoringResult.weaknesses as string[])
      : [];
    const recommendations = Array.isArray(scoringResult?.recommendations)
      ? (scoringResult.recommendations as string[])
      : [];
    const diagnosticText = typeof scoringResult?.diagnosticText === 'string'
      ? scoringResult.diagnosticText
      : '';

    // Build PDF data
    const pdfData: AssessmentPDFData = {
      id: assessment.id,
      studentName: assessment.studentName,
      studentEmail: assessment.studentEmail,
      subject: assessment.subject,
      grade: assessment.grade,
      globalScore: assessment.globalScore ?? 0,
      confidenceIndex: assessment.confidenceIndex ?? 0,
      ssn,
      ssnLevel: ssn !== null ? getSSNLabel(ssn) : null,
      percentile,
      domainScores,
      skillScores,
      strengths,
      weaknesses,
      recommendations,
      diagnosticText,
      createdAt: assessment.createdAt.toISOString(),
    };

    // Render PDF to buffer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfElement = React.createElement(AssessmentPDFDocument, { data: pdfData }) as any;
    const pdfBuffer = await renderToBuffer(pdfElement);

    // Return PDF response
    const fileName = `bilan-nexus-${assessment.studentName.replace(/\s+/g, '-').toLowerCase()}-${assessment.subject.toLowerCase()}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[Assessment Export] Error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du PDF', details: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
