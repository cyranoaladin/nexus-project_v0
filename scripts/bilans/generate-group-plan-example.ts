import fs from 'node:fs';
import path from 'node:path';

const { parse: parseYaml } = require(path.join(path.dirname(require.resolve('yaml/package.json')), 'dist/index.js')) as typeof import('yaml');

import { cpsCatalogSchema } from '@/lib/bilans/catalog/bank-validation';
import type { FactSheet } from '@/lib/bilans/facts/fact-sheet';
import type { GroupBand, NodeProfile } from '@/lib/bilans/facts/types';
import { buildGroupPlan, type GroupMember } from '@/lib/bilans/group-plan/plan';
import { renderGroupPlanPdf } from '@/lib/bilans/group-plan/render';
import { createBilanPdfRendererSession, normalizePdfForComparison } from '@/lib/bilans/render/pdf';
import type { RenderIdentity } from '@/lib/bilans/render/render-identity';
import { buildPreRentreeStageLabel } from '@/lib/bilans/render/stage-label';

const OUTPUT_DIRECTORY = path.join('docs', 'specs', 'bilans', 'exemples');
const SLUG = 'entree-premiere-maths-v1';
const CATALOG_PATH = path.join('data', 'bilans', 'cps', '2de-maths-vers-premiere.v1.yaml');
const PROFILE_ROWS: readonly (readonly NodeProfile[])[] = Object.freeze([
  ['MAITRISE', 'MAITRISE_FRAGILE', 'LACUNE_CONSCIENTE', 'ERREUR_CONFIANTE', 'NON_TRAITE', 'MAITRISE', 'MAITRISE_FRAGILE', 'LACUNE_CONSCIENTE', 'ERREUR_CONFIANTE'],
  ['MAITRISE', 'MAITRISE', 'LACUNE_CONSCIENTE', 'ERREUR_CONFIANTE', 'NON_TRAITE', 'MAITRISE_FRAGILE', 'MAITRISE_FRAGILE', 'ERREUR_CONFIANTE', 'ERREUR_CONFIANTE'],
  ['MAITRISE_FRAGILE', 'MAITRISE', 'MAITRISE_FRAGILE', 'LACUNE_CONSCIENTE', 'NON_TRAITE', 'MAITRISE', 'LACUNE_CONSCIENTE', 'LACUNE_CONSCIENTE', 'MAITRISE_FRAGILE'],
  ['MAITRISE', 'MAITRISE_FRAGILE', 'LACUNE_CONSCIENTE', 'ERREUR_CONFIANTE', 'NON_TRAITE', 'MAITRISE', 'MAITRISE_FRAGILE', 'ERREUR_CONFIANTE', 'LACUNE_CONSCIENTE'],
]);
const BANDS: readonly GroupBand[] = ['RENFORCEMENT', 'CONSOLIDATION_STANDARD', 'CONSOLIDATION_PRIORITAIRE', 'CONSOLIDATION_STANDARD'];

function exampleFactSheet(alias: string, profiles: readonly NodeProfile[], nodeIds: readonly string[], band: GroupBand): FactSheet {
  return Object.freeze({
    engineVersion: '1.0.1', bankSlug: SLUG, bankVersion: 1,
    student: Object.freeze({ alias, level: 'PREMIERE' }), globalScore: 60, coverage: 100,
    calibrationIndex: 72, domains: Object.freeze([]), flags: Object.freeze([]), groupBand: band,
    nodes: Object.freeze(nodeIds.map((nodeCpsId, index) => Object.freeze({
      nodeCpsId, criticality: 1, nodeScore: profiles[index] === 'MAITRISE' ? 100 : 50,
      profile: profiles[index], itemIds: Object.freeze([`SYNTH-${index + 1}`]), priorityRank: index,
    }))),
  });
}

export async function buildGroupPlanExampleArtifacts(): Promise<ReadonlyMap<string, Buffer>> {
  const catalog = cpsCatalogSchema.parse(parseYaml(fs.readFileSync(path.join(process.cwd(), CATALOG_PATH), 'utf8')));
  const nodeIds = [...catalog.nodes].sort((left, right) => left.sequenceOrder - right.sequenceOrder).map(({ id }) => id);
  const members: readonly GroupMember[] = Object.freeze(PROFILE_ROWS.map((profiles, index) => Object.freeze({
    displayName: `Élève ${String.fromCharCode(65 + index)} (synthétique)`,
    factSheet: exampleFactSheet(`ELEVE_${String.fromCharCode(65 + index)}`, profiles, nodeIds, BANDS[index]),
  })));
  const plan = buildGroupPlan(catalog, members);
  const identity: RenderIdentity = Object.freeze({ displayName: 'Groupe synthétique · quatre élèves', level: 'PREMIERE', subject: 'MATHS', date: '2026-08-03', stageLabel: buildPreRentreeStageLabel('PREMIERE', 'MATHS') });
  const session = await createBilanPdfRendererSession();
  try {
    const rendered = await renderGroupPlanPdf(plan, identity, { renderHtmlToPdf: session.renderHtmlToPdf });
    if (rendered.status !== 'AVAILABLE') throw new Error(rendered.errorCode);
    return new Map([[`${SLUG}-groupe.html`, Buffer.from(rendered.html, 'utf8')], [`${SLUG}-groupe.pdf`, normalizePdfForComparison(rendered.pdf)]]);
  } finally { await session.close(); }
}

export async function generateGroupPlanExample(write: boolean): Promise<readonly string[]> {
  const artifacts = await buildGroupPlanExampleArtifacts();
  const names = [...artifacts.keys()].sort();
  const directory = path.join(process.cwd(), OUTPUT_DIRECTORY);
  if (write) fs.mkdirSync(directory, { recursive: true });
  for (const name of names) {
    const content = artifacts.get(name) as Buffer;
    const destination = path.join(directory, name);
    if (write) fs.writeFileSync(destination, content);
    else if (!fs.existsSync(destination) || !fs.readFileSync(destination).equals(content)) throw new Error(`GROUP_EXAMPLE_DIVERGED:${name}`);
  }
  return Object.freeze(names);
}

export async function main(args: readonly string[]): Promise<number> {
  if (args.some((arg) => arg !== '--write' && arg !== '--check')) return 2;
  const names = await generateGroupPlanExample(args.includes('--write'));
  process.stdout.write(`${args.includes('--write') ? 'WRITTEN' : 'VERIFIED'} ${names.length} group artifacts\n`);
  return 0;
}

if (require.main === module) void main(process.argv.slice(2)).then((code) => { process.exitCode = code; }).catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
