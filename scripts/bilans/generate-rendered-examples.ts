import fs from 'node:fs';
import path from 'node:path';

import { PREMIERE_ENTRY_RECIPE_FACT_SHEETS } from '@/__tests__/bilans/fixtures/recipe-fact-sheets';
import { normalizePdfForComparison, renderDeterministicBilanPdf } from '@/lib/bilans/render/pdf';
import type { RenderIdentity } from '@/lib/bilans/render/render-identity';
import { buildPreRentreeStageLabel } from '@/lib/bilans/render/stage-label';
import type { ReportAudience } from '@/lib/bilans/render/profile-copy';

const OUTPUT_DIRECTORY = path.join('docs', 'specs', 'bilans', 'exemples');
const SLUG = 'entree-premiere-maths-v1';
const AUDIENCES = ['ELEVE', 'PARENTS', 'NEXUS'] as const satisfies readonly ReportAudience[];

const IDENTITY: RenderIdentity = Object.freeze({
  displayName: 'Élève de démonstration',
  level: 'PREMIERE',
  subject: 'MATHS',
  date: '2026-08-03',
  stageLabel: buildPreRentreeStageLabel('PREMIERE', 'MATHS'),
});

export async function buildRenderedExampleArtifacts(): Promise<ReadonlyMap<string, Buffer>> {
  const factSheet = PREMIERE_ENTRY_RECIPE_FACT_SHEETS[0];
  const artifacts = new Map<string, Buffer>();

  for (const audience of AUDIENCES) {
    const rendered = await renderDeterministicBilanPdf(factSheet, audience, IDENTITY);
    if (rendered.status !== 'AVAILABLE') {
      throw new Error(`A95_PDF_UNAVAILABLE:${audience}:${rendered.errorCode}`);
    }
    const basename = `${SLUG}-${audience.toLowerCase()}`;
    artifacts.set(`${basename}.html`, Buffer.from(rendered.html, 'utf8'));
    artifacts.set(`${basename}.pdf`, normalizePdfForComparison(rendered.pdf));
  }

  return artifacts;
}

export async function generateRenderedExamples(write: boolean): Promise<readonly string[]> {
  const outputDirectory = path.join(process.cwd(), OUTPUT_DIRECTORY);
  const artifacts = await buildRenderedExampleArtifacts();
  const names = [...artifacts.keys()].sort();

  if (write) fs.mkdirSync(outputDirectory, { recursive: true });
  for (const name of names) {
    const expected = artifacts.get(name);
    if (expected === undefined) throw new Error(`A95_ARTIFACT_MISSING:${name}`);
    const destination = path.join(outputDirectory, name);
    if (write) {
      fs.writeFileSync(destination, expected);
      continue;
    }
    if (!fs.existsSync(destination) || !fs.readFileSync(destination).equals(expected)) {
      throw new Error(`A95_ARTIFACT_DIVERGED:${name}`);
    }
  }
  return Object.freeze(names);
}

export async function main(args: readonly string[]): Promise<number> {
  const write = args.includes('--write');
  if (args.some((arg) => arg !== '--write' && arg !== '--check')) {
    process.stderr.write('Usage: npx tsx scripts/bilans/generate-rendered-examples.ts [--write|--check]\n');
    return 2;
  }
  const names = await generateRenderedExamples(write);
  process.stdout.write(`${write ? 'WRITTEN' : 'VERIFIED'} ${names.length} A95 artifacts\n`);
  return 0;
}

if (require.main === module) {
  void main(process.argv.slice(2)).then((code) => { process.exitCode = code; }).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
