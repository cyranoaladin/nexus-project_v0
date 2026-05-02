import { prisma } from '@/lib/prisma';
import type { CorrectionDocumentTypeValue } from './document-types';

type NpcDocumentStatus = 'UPLOADED' | 'PENDING_CONVERSION' | 'CONVERTING' | 'CONVERSION_FAILED' | 'READY' | 'PROCESSING' | 'ERROR';

export interface CorrectionContextDocument {
  id: string;
  documentType: CorrectionDocumentTypeValue;
  originalFilename: string | null;
  storagePath: string;
  mimeType: string | null;
  sizeBytes: number | null;
  status: NpcDocumentStatus;
  uploadedAt: Date;
}

export interface CorrectionContext {
  correction: {
    id: string;
    title: string;
    subject: string;
    gradeLevel: string | null;
    description: string | null;
    status: string;
  };
  documents: {
    studentCopies: CorrectionContextDocument[];
    subjects: CorrectionContextDocument[];
    officialCorrections: CorrectionContextDocument[];
    gradingRubrics: CorrectionContextDocument[];
    gradingInstructions: CorrectionContextDocument[];
    supportingDocuments: CorrectionContextDocument[];
  };
  readiness: {
    canLaunchAi: boolean;
    warnings: string[];
  };
}

function toContextDocument(page: {
  id: string;
  documentType: string;
  originalFilename: string | null;
  originalFilePath: string;
  mimeType: string | null;
  sizeBytes: number | null;
  status: string;
  createdAt: Date;
}): CorrectionContextDocument {
  return {
    id: page.id,
    documentType: page.documentType as CorrectionDocumentTypeValue,
    originalFilename: page.originalFilename,
    storagePath: page.originalFilePath,
    mimeType: page.mimeType,
    sizeBytes: page.sizeBytes,
    status: page.status as NpcDocumentStatus,
    uploadedAt: page.createdAt,
  };
}

export async function buildCorrectionContext(correctionId: string): Promise<CorrectionContext> {
  const submission = await prisma.copySubmission.findUnique({
    where: { id: correctionId },
    select: {
      id: true,
      title: true,
      subject: true,
      gradeLevel: true,
      description: true,
      status: true,
      pages: {
        orderBy: { pageNumber: 'asc' },
        select: {
          id: true,
          documentType: true,
          originalFilename: true,
          originalFilePath: true,
          mimeType: true,
          sizeBytes: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });

  if (!submission) {
    throw new Error('Correction submission not found');
  }

  const documents = submission.pages.map(toContextDocument);
  const studentCopies = documents.filter((doc) => doc.documentType === 'STUDENT_COPY');
  const subjects = documents.filter((doc) => doc.documentType === 'SUBJECT');
  const officialCorrections = documents.filter((doc) => doc.documentType === 'OFFICIAL_CORRECTION');
  const gradingRubrics = documents.filter((doc) => doc.documentType === 'GRADING_RUBRIC');
  const gradingInstructions = documents.filter((doc) => doc.documentType === 'GRADING_INSTRUCTIONS');
  const supportingDocuments = documents.filter((doc) => doc.documentType === 'SUPPORTING_DOCUMENT');

  const warnings: string[] = [];
  if (studentCopies.length === 0) warnings.push('MISSING_STUDENT_COPY');
  if (subjects.length === 0) warnings.push('MISSING_SUBJECT');
  if (gradingRubrics.length === 0) warnings.push('MISSING_GRADING_RUBRIC');
  if (officialCorrections.length === 0) warnings.push('MISSING_OFFICIAL_CORRECTION');
  if (documents.some((doc) => doc.status !== 'UPLOADED' && doc.status !== 'READY')) {
    warnings.push('DOCUMENTS_NOT_READY');
  }

  const hasMinimalCorrectionInstructions =
    subjects.length > 0 || gradingRubrics.length > 0 || gradingInstructions.length > 0;

  return {
    correction: {
      id: submission.id,
      title: submission.title,
      subject: String(submission.subject),
      gradeLevel: submission.gradeLevel ? String(submission.gradeLevel) : null,
      description: submission.description,
      status: String(submission.status),
    },
    documents: {
      studentCopies,
      subjects,
      officialCorrections,
      gradingRubrics,
      gradingInstructions,
      supportingDocuments,
    },
    readiness: {
      canLaunchAi:
        studentCopies.length > 0 &&
        hasMinimalCorrectionInstructions &&
        !warnings.includes('DOCUMENTS_NOT_READY'),
      warnings,
    },
  };
}
