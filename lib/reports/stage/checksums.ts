import { createHash } from 'crypto';

export function computeInputChecksum({
  studentBilanUpdatedAt,
  coachReportUpdatedAt,
  promptVersion,
  templateVersion,
}: {
  studentBilanUpdatedAt: Date | string;
  coachReportUpdatedAt: Date | string;
  promptVersion: string;
  templateVersion: string;
}): string {
  const hash = createHash('sha256');
  
  const sDate = typeof studentBilanUpdatedAt === 'string' ? studentBilanUpdatedAt : studentBilanUpdatedAt.toISOString();
  const cDate = typeof coachReportUpdatedAt === 'string' ? coachReportUpdatedAt : coachReportUpdatedAt.toISOString();
  
  hash.update(`${sDate}_${cDate}_${promptVersion}_${templateVersion}`);
  return hash.digest('hex');
}
