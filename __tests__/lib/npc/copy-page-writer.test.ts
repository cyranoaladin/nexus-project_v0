import {
  createCopyPage,
  createManyAndReturnCopyPages,
  createManyCopyPages,
  upsertCopyPage,
} from '@/lib/npc/copy-page-writer';

describe('typed CopyPage write boundary', () => {
  const copyPage = {
    create: jest.fn(),
    createManyAndReturn: jest.fn(),
    createMany: jest.fn(),
    upsert: jest.fn(),
  };
  const client = { copyPage } as never;
  const data = {
    submissionId: 'submission-1',
    pageNumber: 1,
    originalFilePath: 'student/submission/page-1.pdf',
    documentType: 'STUDENT_COPY' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards create payloads with their explicit document type', async () => {
    copyPage.create.mockResolvedValue({ id: 'page-1' });

    await createCopyPage(client, { data });

    expect(copyPage.create).toHaveBeenCalledWith({ data });
  });

  it('forwards every explicitly typed createMany row', async () => {
    copyPage.createMany.mockResolvedValue({ count: 2 });
    const second = { ...data, pageNumber: 2, documentType: 'SUBJECT' as const };

    await createManyCopyPages(client, { data: [data, second] });

    expect(copyPage.createMany).toHaveBeenCalledWith({ data: [data, second] });
  });

  it('forwards every explicitly typed createManyAndReturn row', async () => {
    copyPage.createManyAndReturn.mockResolvedValue([{ id: 'page-1' }, { id: 'page-2' }]);
    const second = { ...data, pageNumber: 2, documentType: 'SUBJECT' as const };

    await createManyAndReturnCopyPages(client, { data: [data, second] });

    expect(copyPage.createManyAndReturn).toHaveBeenCalledWith({ data: [data, second] });
  });

  it('forwards upsert create payloads with their explicit document type', async () => {
    copyPage.upsert.mockResolvedValue({ id: 'page-1' });

    await upsertCopyPage(client, {
      where: { id: 'page-1' },
      create: data,
      update: { pageNumber: 1 },
    });

    expect(copyPage.upsert).toHaveBeenCalledWith({
      where: { id: 'page-1' },
      create: data,
      update: { pageNumber: 1 },
    });
  });
});
