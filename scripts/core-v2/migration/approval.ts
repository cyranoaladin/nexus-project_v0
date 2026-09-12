/**
 * The owner's roster approval — a separate, human-produced file, never the
 * candidate report. Its digest is recorded in every manifest so "what was
 * approved" and "what was migrated" stay verifiable against each other.
 * Contains ids only: no names, no contact data (§AQ: no PII in Git).
 */
import { createHash } from 'node:crypto';
import { z } from 'zod';

export const approvalFileSchema = z
  .object({
    schoolYear: z.string().regex(/^\d{4}-\d{4}$/),
    academicYear: z.object({
      startYear: z.number().int().min(2000).max(2100),
      startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
    approvedStudentIds: z.array(z.string().min(1).max(64)).min(1),
    approvedBy: z.string().min(1).max(200),
    approvedAt: z.string().datetime(),
  })
  .strict()
  .refine((v) => v.schoolYear.startsWith(String(v.academicYear.startYear)), { message: 'schoolYear must start with academicYear.startYear' })
  .refine((v) => new Set(v.approvedStudentIds).size === v.approvedStudentIds.length, { message: 'approvedStudentIds must be unique' });

export type ApprovalFile = z.infer<typeof approvalFileSchema>;

export function parseApprovalFile(raw: unknown): ApprovalFile {
  return approvalFileSchema.parse(raw);
}

/** Order-independent digest of the approval (sorted ids + year); the manifest carries it. */
export function approvalDigest(approval: ApprovalFile): string {
  const canonical = JSON.stringify({
    schoolYear: approval.schoolYear,
    academicYear: approval.academicYear,
    approvedStudentIds: [...approval.approvedStudentIds].sort(),
    approvedBy: approval.approvedBy,
    approvedAt: approval.approvedAt,
  });
  return createHash('sha256').update(canonical).digest('hex');
}
