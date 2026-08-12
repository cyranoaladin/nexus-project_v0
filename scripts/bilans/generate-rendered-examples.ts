import fs from 'node:fs';
import path from 'node:path';

import { PREMIERE_ENTRY_RECIPE_FACT_SHEETS } from '@/__tests__/bilans/fixtures/recipe-fact-sheets';
import { loadBilanPack } from '@/lib/bilans/catalog/load-pack';
import type { FactSheet } from '@/lib/bilans/facts/fact-sheet';
import {
  createBilanPdfRendererSession,
  extractPdfText,
  normalizePdfForComparison,
  renderDeterministicBilanPdf,
} from '@/lib/bilans/render/pdf';
import {
  buildQuestionEvidence,
  type QuestionEvidence,
} from '@/lib/bilans/render/question-evidence';
import type { RenderIdentity } from '@/lib/bilans/render/render-identity';
import { buildPreRentreeStageLabel } from '@/lib/bilans/render/stage-label';
import type { ReportAudience } from '@/lib/bilans/render/profile-copy';

const OUTPUT_DIRECTORY = path.join('docs', 'specs', 'bilans', 'exemples');
const SLUG = 'entree-premiere-maths-v1';
const PACK_PATH = path.join('data', 'bilans', 'banks', `${SLUG}.json`);
const AUDIENCES = ['ELEVE', 'PARENTS', 'NEXUS'] as const satisfies readonly ReportAudience[];

const IDENTITY: RenderIdentity = Object.freeze({
  displayName: 'ELEVE_DEMONSTRATION',
  level: 'PREMIERE',
  subject: 'MATHS',
  date: '2026-08-03',
  stageLabel: buildPreRentreeStageLabel('PREMIERE', 'MATHS'),
});

/**
 * Réponses de démonstration, dérivées déterministiquement des profils du
 * FactSheet de recette : chaque item reçoit la réponse et la certitude qui
 * correspondent au profil de son domaine, pour que le « Détail des
 * réponses » des exemples soit cohérent avec la carte des profils.
 * Lecture seule sur la banque — rien n'y est modifié.
 */
function buildDemonstrationEvidence(factSheet: FactSheet): QuestionEvidence {
  const pack = loadBilanPack(PACK_PATH);
  const profiles = new Map(factSheet.domains.map(({ id, profile }) => [id, profile]));
  const answers: Record<string, { optionId: string; confidence: 1 | 2 | 3 | 4 | null }> = {};
  for (const item of pack.questionnaire.items) {
    const profile = profiles.get(item.domainId) ?? 'MAITRISE';
    if (profile === 'NON_TRAITE') continue;
    const correct = item.options.find(({ isCorrect }) => isCorrect);
    const wrong = item.options.find(({ isCorrect }) => !isCorrect);
    if (correct === undefined || wrong === undefined) continue;
    if (profile === 'MAITRISE') answers[item.id] = { optionId: correct.id, confidence: 4 };
    else if (profile === 'MAITRISE_FRAGILE') answers[item.id] = { optionId: correct.id, confidence: 2 };
    else if (profile === 'LACUNE_CONSCIENTE') answers[item.id] = { optionId: wrong.id, confidence: 1 };
    else answers[item.id] = { optionId: wrong.id, confidence: 4 };
  }
  return buildQuestionEvidence(pack, answers);
}

export async function buildRenderedExampleArtifacts(): Promise<ReadonlyMap<string, Buffer>> {
  const factSheet = PREMIERE_ENTRY_RECIPE_FACT_SHEETS[0];
  const evidence = buildDemonstrationEvidence(factSheet);
  const artifacts = new Map<string, Buffer>();
  const session = await createBilanPdfRendererSession();

  try {
    for (const audience of AUDIENCES) {
      const rendered = await renderDeterministicBilanPdf(
        factSheet,
        audience,
        IDENTITY,
        { renderHtmlToPdf: session.renderHtmlToPdf, evidence },
      );
      if (rendered.status !== 'AVAILABLE') {
        throw new Error(`A95_PDF_UNAVAILABLE:${audience}:${rendered.errorCode}`);
      }
      const basename = `${SLUG}-${audience.toLowerCase()}`;
      artifacts.set(`${basename}.html`, Buffer.from(rendered.html, 'utf8'));
      artifacts.set(`${basename}.pdf`, normalizePdfForComparison(rendered.pdf));
    }
  } finally {
    await session.close();
  }

  return artifacts;
}

/**
 * Vérification d'un artefact committé. Les HTML se comparent octet par
 * octet (rendu déterministe). Les PDF se comparent sur leur texte extrait :
 * les glyphes de banque hors couverture DM Sans (√, ≥, ≤, ∪, ∩) passent par
 * une police de repli du système hôte, donc les octets d'un même contenu
 * varient d'une machine à l'autre — le contenu, lui, ne varie pas.
 */
async function assertArtifactMatches(name: string, expected: Buffer, committedPath: string): Promise<void> {
  if (!fs.existsSync(committedPath)) throw new Error(`A95_ARTIFACT_DIVERGED:${name}`);
  const committed = fs.readFileSync(committedPath);
  if (name.endsWith('.html')) {
    if (!committed.equals(expected)) throw new Error(`A95_ARTIFACT_DIVERGED:${name}`);
    return;
  }
  if (expected.subarray(0, 4).toString() !== '%PDF' || committed.subarray(0, 4).toString() !== '%PDF') {
    throw new Error(`A95_ARTIFACT_DIVERGED:${name}`);
  }
  const [expectedText, committedText] = await Promise.all([
    extractPdfText(expected),
    extractPdfText(committed),
  ]);
  if (expectedText.length === 0 || expectedText !== committedText) {
    throw new Error(`A95_ARTIFACT_DIVERGED:${name}`);
  }
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
    await assertArtifactMatches(name, expected, destination);
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
