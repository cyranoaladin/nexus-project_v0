import { PaymentType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { PaymentCatalogItem, PaymentCatalogType } from '@/lib/security/payment-catalog';

export class BankTransferOwnershipError extends Error {
  constructor() { super('BANK_TRANSFER_OWNERSHIP_DENIED'); }
}

export interface BankTransferDeclaration {
  readonly parentUserId: string;
  readonly parentName: string;
  readonly studentId: string | null;
  readonly itemType: PaymentCatalogType;
  readonly itemKey: string;
  readonly catalog: PaymentCatalogItem;
  readonly termsVersion: string;
  readonly clientIp: string;
  readonly immediateExecution: boolean;
  readonly now: Date;
}

type RunTransaction = <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T>;

/** Only a legacy mutation-authorized caller may enter this V1 service. */
export async function declarePendingBankTransfer(
  input: BankTransferDeclaration,
  runTransaction: RunTransaction = work => prisma.$transaction(work),
) {
  return runTransaction(async tx => {
    // Lock a stable existing parent row before duplicate lookup. All declarations
    // of this parent serialize; user deletion also cannot race payment creation.
    const parent = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM users WHERE id = ${input.parentUserId} AND role = 'PARENT' FOR UPDATE
    `);
    if (parent.length !== 1) throw new BankTransferOwnershipError();
    if (input.studentId) {
      const student = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT s.id FROM students AS s
        JOIN parent_profiles AS p ON p.id = s."parentId"
        WHERE s.id = ${input.studentId} AND p."userId" = ${input.parentUserId}
        FOR SHARE OF s, p
      `);
      // Hold ownership through commit: reassignment/deletion cannot follow a stale read.
      if (student.length !== 1) throw new BankTransferOwnershipError();
    }
    const paymentType = input.itemType === 'subscription' ? PaymentType.SUBSCRIPTION : PaymentType.SPECIAL_PACK;
    const existing = await tx.payment.findFirst({
      where: {
        userId: input.parentUserId, method: 'bank_transfer', status: 'PENDING', currency: 'TND',
        type: input.itemType === 'pack' ? { in: [PaymentType.SPECIAL_PACK, PaymentType.CREDIT_PACK] } : paymentType,
        amount: input.catalog.amount, description: input.catalog.description,
        AND: [
          { metadata: { path: ['itemKey'], equals: input.itemKey } },
          { metadata: { path: ['itemType'], equals: input.itemType } },
          { metadata: { path: ['studentId'], equals: input.studentId ?? Prisma.JsonNull } },
        ],
      },
      select: { id: true },
    });
    if (existing) return { paymentId: existing.id, alreadyExists: true } as const;
    const payment = await tx.payment.create({
      data: {
        userId: input.parentUserId, type: paymentType, amount: input.catalog.amount, currency: 'TND',
        description: input.catalog.description, status: 'PENDING', method: 'bank_transfer',
        termsVersion: input.termsVersion, termsAcceptedAt: input.now, termsAcceptedIp: input.clientIp,
        immediateExecution: input.immediateExecution,
        metadata: { itemKey: input.itemKey, itemType: input.itemType, studentId: input.studentId,
          declaredAt: input.now.toISOString(), declaredBy: input.parentUserId },
      },
      select: { id: true },
    });
    const staff = await tx.user.findMany({ where: { role: { in: ['ADMIN', 'ASSISTANTE'] } }, select: { id: true, role: true } });
    if (staff.length > 0) {
      await tx.notification.createMany({ data: staff.map(user => ({
        userId: user.id, userRole: user.role, type: 'BANK_TRANSFER_DECLARED', title: 'Nouveau virement déclaré',
        message: `${input.parentName} a déclaré un virement de ${input.catalog.amount} TND pour « ${input.catalog.description} ». En attente de validation.`,
        data: { paymentId: payment.id, parentId: input.parentUserId, parentName: input.parentName,
          amount: input.catalog.amount, description: input.catalog.description },
      })) });
    }
    return { paymentId: payment.id, alreadyExists: false } as const;
  });
}
