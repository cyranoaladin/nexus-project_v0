import type { CorrectionDocumentType, Prisma } from '@prisma/client';

export type CopyPageWriteClient = Pick<Prisma.TransactionClient, 'copyPage'>;

type WithExplicitDocumentType<T> = T & {
  documentType: CorrectionDocumentType;
};

export type ExplicitCopyPageCreateArgs = Omit<Prisma.CopyPageCreateArgs, 'data'> & {
  data: WithExplicitDocumentType<Prisma.CopyPageCreateArgs['data']>;
};

export type ExplicitCopyPageCreateManyArgs = Omit<Prisma.CopyPageCreateManyArgs, 'data'> & {
  data:
    | WithExplicitDocumentType<Prisma.CopyPageCreateManyInput>
    | Array<WithExplicitDocumentType<Prisma.CopyPageCreateManyInput>>;
};

export type ExplicitCopyPageUpsertArgs = Omit<Prisma.CopyPageUpsertArgs, 'create'> & {
  create: WithExplicitDocumentType<Prisma.CopyPageUpsertArgs['create']>;
};

export function createCopyPage(
  client: CopyPageWriteClient,
  args: ExplicitCopyPageCreateArgs,
) {
  return client.copyPage.create(args);
}

export function createManyCopyPages(
  client: CopyPageWriteClient,
  args: ExplicitCopyPageCreateManyArgs,
) {
  return client.copyPage.createMany(args);
}

export function upsertCopyPage(
  client: CopyPageWriteClient,
  args: ExplicitCopyPageUpsertArgs,
) {
  return client.copyPage.upsert(args);
}
