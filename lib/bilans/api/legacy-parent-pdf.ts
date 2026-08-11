/**
 * Compatibility handler for legacy Bilan records still linked by the Parent stages dashboard.
 * Access follows the same current ParentStudentLink authority as Canonical Parent reports.
 */

import type { PrismaClient } from '@prisma/client';
import type { Session } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/auth';
import {
  renderLegacyParentBilanPdf,
  type LegacyParentBilanData,
} from '@/lib/bilans/render/legacy-parent-adapter';
import { prisma } from '@/lib/prisma';

import { CanonicalApiError } from './errors';
import { canonicalErrorResponse } from './http';
import {
  resolveParentOwnedStudent,
  validParentResourceId,
  withParentPrivateNoStore,
} from './parent-access';

const SUBJECT_LABEL: Readonly<Record<string, string>> = Object.freeze({
  MATHEMATIQUES: 'Mathématiques',
  FRANCAIS: 'Français / EAF',
});

type LegacyParentPdfDatabase = Pick<PrismaClient, 'bilan' | 'student' | 'parentStudentLink'>;

type LegacyParentPdfDependencies = Readonly<{
  prisma: LegacyParentPdfDatabase;
  authenticate: () => Promise<Session | null>;
  renderPdf: (data: LegacyParentBilanData) => Promise<Buffer>;
  now: () => Date;
  logger?: Readonly<{ error(event: Readonly<Record<string, unknown>>): void }>;
}>;

type RouteContext = Readonly<{ params: Promise<Readonly<{ id: string }>> }>;

const defaultDependencies: LegacyParentPdfDependencies = {
  prisma,
  authenticate: auth,
  renderPdf: renderLegacyParentBilanPdf,
  now: () => new Date(),
  logger: { error: (event) => console.error(JSON.stringify(event)) },
};

function safeFileSegment(value: string, fallback: string): string {
  const safe = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return safe || fallback;
}

function validPdf(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

export function createGetLegacyParentBilanPdfHandler(
  dependencies: LegacyParentPdfDependencies = defaultDependencies,
): (request: NextRequest, context: RouteContext) => Promise<NextResponse> {
  return async (_request, context) => {
    try {
      const session = await dependencies.authenticate();
      if (session?.user === undefined) throw CanonicalApiError.unauthenticated();
      if (session.user.role !== 'PARENT') throw CanonicalApiError.notFound();

      const { id } = await context.params;
      if (!validParentResourceId(id)) throw CanonicalApiError.notFound();

      const reference = await dependencies.prisma.bilan.findFirst({
        where: { id, isPublished: true, studentId: { not: null } },
        select: { studentId: true },
      });
      if (reference?.studentId === null || reference?.studentId === undefined) {
        throw CanonicalApiError.notFound();
      }

      await resolveParentOwnedStudent(session, reference.studentId, dependencies.prisma, dependencies.now());

      const bilan = await dependencies.prisma.bilan.findFirst({
        where: { id, isPublished: true, studentId: reference.studentId },
        select: {
          subject: true,
          studentName: true,
          parentsMarkdown: true,
          publishedAt: true,
          createdAt: true,
          stage: { select: { title: true } },
          coach: { select: { pseudonym: true } },
          student: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
      });
      if (bilan === null || bilan.parentsMarkdown === null) throw CanonicalApiError.notFound();

      const childName = bilan.student?.user
        ? `${bilan.student.user.firstName ?? ''} ${bilan.student.user.lastName ?? ''}`.trim()
        : bilan.studentName;
      const pdfData: LegacyParentBilanData = {
        studentName: childName || bilan.studentName || 'Élève',
        stageTitle: bilan.stage?.title ?? 'Stage',
        subjectLabel: SUBJECT_LABEL[bilan.subject] ?? bilan.subject,
        coachName: bilan.coach?.pseudonym ?? null,
        publishedAt: (bilan.publishedAt ?? bilan.createdAt).toISOString(),
        globalScore: null,
        parentsMarkdown: bilan.parentsMarkdown,
      };

      const pdfBuffer = await dependencies.renderPdf(pdfData);
      if (!validPdf(pdfBuffer)) throw new Error('LEGACY_PARENT_PDF_INVALID');

      const childSegment = safeFileSegment(childName || 'eleve', 'eleve');
      const subjectSegment = safeFileSegment(bilan.subject, 'bilan');
      return withParentPrivateNoStore(new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': `attachment; filename="bilan-nexus-${childSegment}-${subjectSegment}.pdf"`,
        },
      }));
    } catch (error) {
      dependencies.logger?.error({
        event: 'legacy_parent_pdf_failed',
        errorName: error instanceof Error ? error.name : 'unknown',
      });
      return withParentPrivateNoStore(canonicalErrorResponse(error));
    }
  };
}
