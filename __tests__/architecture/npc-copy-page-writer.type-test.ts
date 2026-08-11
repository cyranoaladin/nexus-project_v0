import type { Prisma } from '@prisma/client';
import {
  createCopyPage,
  createManyCopyPages,
  upsertCopyPage,
  type CopyPageWriteClient,
} from '@/lib/npc/copy-page-writer';

declare const client: CopyPageWriteClient;

const dataWithoutDocumentType: Prisma.CopyPageUncheckedCreateInput = {
  submissionId: 'submission-1',
  pageNumber: 1,
  originalFilePath: 'student/submission/page-1.pdf',
};

if (false) {
  createCopyPage(client, {
    data: { ...dataWithoutDocumentType, documentType: 'STUDENT_COPY' },
  });
  createManyCopyPages(client, {
    data: [{ ...dataWithoutDocumentType, documentType: 'SUBJECT' }],
  });
  upsertCopyPage(client, {
    where: { id: 'page-1' },
    create: { ...dataWithoutDocumentType, documentType: 'GRADING_RUBRIC' },
    update: {},
  });

  // @ts-expect-error documentType is required by the canonical boundary.
  createCopyPage(client, { data: dataWithoutDocumentType });
  // @ts-expect-error every createMany row requires documentType.
  createManyCopyPages(client, { data: [dataWithoutDocumentType] });
  upsertCopyPage(client, {
    where: { id: 'page-1' },
    // @ts-expect-error the upsert create branch requires documentType.
    create: dataWithoutDocumentType,
    update: {},
  });
}
