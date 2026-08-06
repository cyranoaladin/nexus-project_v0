import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

function typescriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const candidate = path.join(directory, entry);
    if (statSync(candidate).isDirectory()) return typescriptFiles(candidate);
    return /\.tsx?$/.test(entry) ? [candidate] : [];
  });
}

describe('A102 Scoring V2 canonical boundary', () => {
  it('interdit tout import du moteur diagnostic legacy depuis lib/bilans', () => {
    const offenders = typescriptFiles(path.join(process.cwd(), 'lib/bilans'))
      .filter((file) => /(?:from\s+|import\s*\()['"][^'"]*score-diagnostic['"]/.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(process.cwd(), file));

    expect(offenders).toEqual([]);
  });

  it('interdit les indicateurs legacy sans source dans le socle Canonical', () => {
    const forbidden = /\b(examReadinessIndex|riskIndex|readinessScore|trustScore|coverageProgramme|quickWins|inconsistencies)\b/;
    const offenders = typescriptFiles(path.join(process.cwd(), 'lib/bilans'))
      .filter((file) => forbidden.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(process.cwd(), file));

    expect(offenders).toEqual([]);
  });
});
