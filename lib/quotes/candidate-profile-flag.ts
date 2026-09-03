/**
 * Server-governed feature flag for the ProfilCandidat staff workflow
 * (Track A, Section A12). Read from BusinessConfig (same pattern as
 * margin.server.ts's commercial cost policy) — never a client-visible
 * toggle, never hardcoded. Fails closed to DISABLED whenever no override
 * exists or the stored value doesn't parse: a missing/malformed config
 * row must never be silently read as "on".
 */
import 'server-only';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

export const CANDIDATE_PROFILE_FLAG_NAMESPACE = 'candidatIndividuel.profileWorkflow';
export const CANDIDATE_PROFILE_FLAG_KEY = 'default';

export type CandidateProfileWorkflowStatus = 'DISABLED' | 'ACTIVE_INTERNAL';

const flagSchema = z
  .object({
    status: z.enum(['DISABLED', 'ACTIVE_INTERNAL']),
  })
  .strict();

export async function getCandidateProfileWorkflowStatus(): Promise<CandidateProfileWorkflowStatus> {
  const row = await prisma.businessConfig.findUnique({
    where: { namespace_key: { namespace: CANDIDATE_PROFILE_FLAG_NAMESPACE, key: CANDIDATE_PROFILE_FLAG_KEY } },
  });
  if (!row) return 'DISABLED';
  const parsed = flagSchema.safeParse(row.value);
  return parsed.success ? parsed.data.status : 'DISABLED';
}
