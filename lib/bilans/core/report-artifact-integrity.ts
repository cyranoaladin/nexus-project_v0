import { createHash } from 'node:crypto';

export type StoredReportAudience = 'ELEVE' | 'PARENTS' | 'NEXUS';

function sha256(parts: readonly (string | Buffer)[]): string {
  const hash = createHash('sha256');
  for (const part of parts) {
    const value = typeof part === 'string' ? Buffer.from(part, 'utf8') : part;
    hash.update(Buffer.from(String(value.byteLength), 'ascii'));
    hash.update(Buffer.from(':', 'ascii'));
    hash.update(value);
  }
  return hash.digest('hex');
}

export function audienceArtifactChecksum(input: Readonly<{
  audience: StoredReportAudience;
  html: string;
  pdfStatus: 'READY' | 'UNAVAILABLE';
  pdf: Buffer | Uint8Array | null;
}>): string {
  return sha256([
    input.audience,
    input.html,
    input.pdfStatus,
    input.pdf === null ? Buffer.alloc(0) : Buffer.from(input.pdf),
  ]);
}

export function materializationGlobalChecksum(
  brandVersion: string,
  artifacts: readonly Readonly<{ audience: StoredReportAudience; checksum: string }>[],
): string {
  const ordered = [...artifacts].sort((left, right) => left.audience.localeCompare(right.audience));
  return sha256([brandVersion, ...ordered.flatMap(({ audience, checksum }) => [audience, checksum])]);
}

const PUBLIC_FORBIDDEN = [
  '__CORRECT__',
  '__RATIONALE__',
  'isCorrect',
  'explanation',
  'distractorRationale',
  'internalFacts',
  'globalScore',
  'domainScores',
  'calibrationIndex',
] as const;

export function assertPublicRenderedArtifact(
  audience: StoredReportAudience,
  html: string,
  technicalSlug: string,
): void {
  if (audience === 'NEXUS') return;
  if (
    PUBLIC_FORBIDDEN.some((marker) => html.includes(marker))
    || (technicalSlug.trim().length > 0 && html.includes(technicalSlug))
  ) throw new Error('REPORT_PUBLIC_ARTIFACT_DISCLOSURE');
}

export function storedAudienceArtifactIsIntact(input: Readonly<{
  audience: StoredReportAudience;
  html: string;
  pdfStatus: 'READY' | 'UNAVAILABLE';
  pdf: Buffer | Uint8Array | null;
  checksum: string;
}>): boolean {
  return audienceArtifactChecksum(input) === input.checksum;
}
