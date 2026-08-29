import 'server-only';
import { Prisma } from '@prisma/client';

export interface LockedProfilCandidatVersion {
  id: string;
  updatedAt: Date;
}

/**
 * Shared serialization point for every operation that can mutate a
 * ProfilCandidat or create a Quote from it. The lock is transaction-scoped
 * by PostgreSQL and carries no application-level token or logged identifier.
 */
export async function lockProfilCandidatForQuote(
  transaction: Prisma.TransactionClient,
  profilId: string,
): Promise<LockedProfilCandidatVersion | null> {
  const rows = await transaction.$queryRaw<LockedProfilCandidatVersion[]>(Prisma.sql`
    SELECT "id", "updatedAt"
    FROM "profils_candidats"
    WHERE "id" = ${profilId}
    FOR UPDATE
  `);
  return rows[0] ?? null;
}

export class ProfilCandidatVersionConflictError extends Error {
  constructor() {
    super('Profil candidat modifié depuis la simulation. Relancer la simulation avant de créer le devis.');
    this.name = 'ProfilCandidatVersionConflictError';
  }
}
