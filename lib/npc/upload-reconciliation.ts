import type { PrismaClient, UserRole } from '@prisma/client';
import { deleteSecureFile } from './storage';

type ReconciliationClient = Pick<PrismaClient, 'copyPage' | 'npcAuditLog'>;

export class NpcFileCleanupDurabilityError extends Error {
  constructor() {
    super('NPC file cleanup durability failed');
    this.name = 'NpcFileCleanupDurabilityError';
  }
}

export async function reconcileStagedNpcFiles({
  prisma,
  submissionId,
  actorId,
  actorRole,
  relativePaths,
}: {
  prisma: ReconciliationClient;
  submissionId: string;
  actorId: string;
  actorRole: UserRole;
  relativePaths: readonly string[];
}): Promise<void> {
  for (const relativePath of [...new Set(relativePaths)]) {
    let reference: { id: string } | null;
    try {
      reference = await prisma.copyPage.findFirst({
        where: { originalFilePath: relativePath },
        select: { id: true },
      });
    } catch {
      console.error('NPC_FILE_RECONCILIATION_REFERENCE_CHECK_FAILED');
      throw new NpcFileCleanupDurabilityError();
    }

    if (reference) continue;
    if (await deleteSecureFile(relativePath)) continue;

    try {
      await prisma.npcAuditLog.create({
        data: {
          actorId,
          actorRole,
          action: 'NPC_FILE_CLEANUP_REQUIRED',
          entityType: 'CopySubmission',
          entityId: submissionId,
          details: { relativePath },
        },
      });
    } catch {
      console.error('NPC_FILE_CLEANUP_AUDIT_FAILED');
      throw new NpcFileCleanupDurabilityError();
    }
  }
}
