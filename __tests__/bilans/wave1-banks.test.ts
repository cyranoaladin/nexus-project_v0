import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const { parse: parseYaml } = require(path.join(
  path.dirname(require.resolve('yaml/package.json')),
  'dist/index.js',
)) as typeof import('yaml');

import { validateBankCollection, type SourceBank } from '@/lib/bilans/catalog/bank-validation';
import { loadBilanPack } from '@/lib/bilans/catalog/load-pack';
import { isPackEnabled } from '@/lib/bilans/api/pack-access';
import { loadWaveManifest, repositoryPath } from '@/lib/bilans/catalog/wave-manifest';
import { convertBankBatch } from '@/scripts/bilans/convert-bank-batch';
import { buildDashboard } from '@/scripts/bilans/check-pack-completeness';
import { generateMockRecipeEvidence } from '@/scripts/bilans/generate-mock-recipe-evidence';
import { resolveCpsCatalog } from '@/scripts/bilans/yaml-bank-to-pack';

import { buildRecipeFactSheets } from './fixtures/recipe-fact-sheets';
import { fixtureFrom } from './fixtures/validated-pack';

const MANIFEST_PATH = 'data/bilans/banks/wave1.manifest.json';
const MANIFEST = loadWaveManifest(MANIFEST_PATH);
const ACTIVE = MANIFEST.banks.map((entry) => {
  const bank = parseYaml(fs.readFileSync(repositoryPath(entry.source), 'utf8')) as SourceBank;
  return { entry, bank, catalog: resolveCpsCatalog(bank, entry.cps) };
});

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

describe('wave 1 active banks', () => {
  it('contains exactly seventeen complete banks, 306 globally unique items and 153 CPS references', () => {
    expect(ACTIVE).toHaveLength(17);
    const ids = ACTIVE.flatMap(({ bank }) => bank.items.map(({ id }) => id));
    const nodes = ACTIVE.flatMap(({ bank }) => bank.items.map(({ nodeCpsId }) => nodeCpsId));
    expect(ids).toHaveLength(306);
    expect(new Set(ids).size).toBe(306);
    expect(nodes).toHaveLength(306);
    expect(new Set(nodes).size).toBe(153);
    expect(ACTIVE.reduce((sum, { catalog }) => sum + catalog.nodes.length, 0)).toBe(153);
    expect(validateBankCollection(ACTIVE)).toEqual([]);
  });

  it('contains the seven declared disciplines and keeps the two mathematics subjects distinct', () => {
    expect([...new Set(ACTIVE.map(({ bank }) => bank.subject))].sort()).toEqual([
      'FRANCAIS', 'MATHS', 'MATHS_EXPERTES', 'NSI', 'PHILOSOPHIE', 'PHYSIQUE_CHIMIE', 'SVT',
    ]);
    expect(ACTIVE.find(({ entry }) => entry.slug === 'entree-terminale-maths-v1')?.bank.subject).toBe('MATHS');
    expect(ACTIVE.find(({ entry }) => entry.slug === 'entree-terminale-maths-expertes-v1')?.bank.subject).toBe('MATHS_EXPERTES');
  });

  it('keeps mathematics and mathematics-expert CPS nodes disjoint', () => {
    const nodesFor = (slug: string) => new Set(ACTIVE.find(({ entry }) => entry.slug === slug)!
      .bank.items.map(({ nodeCpsId }) => nodeCpsId));
    const mathematics = nodesFor('entree-terminale-maths-v1');
    const experts = nodesFor('entree-terminale-maths-expertes-v1');
    expect([...experts].filter((nodeId) => mathematics.has(nodeId))).toEqual([]);
  });

  it.each(ACTIVE)('$entry.slug satisfies V1-V14 and remains an unsigned DRAFT', ({ entry, bank, catalog }) => {
    expect(bank.items).toHaveLength(18);
    expect(new Set(bank.items.map(({ nodeCpsId }) => nodeCpsId)).size).toBe(9);
    expect(Object.hasOwn(bank, 'review')).toBe(false);
    const distribution = [0, 0, 0, 0];
    for (const current of bank.items) distribution[current.options!.findIndex(({ correct }) => correct)] += 1;
    expect(distribution).toEqual([5, 5, 4, 4]);
    expect(catalog.nodes).toHaveLength(9);
    expect([...catalog.nodes].sort((left, right) => left.sequenceOrder - right.sequenceOrder).map(({ id }) => id)).toEqual([...new Set(bank.items.map(({ nodeCpsId }) => nodeCpsId))]);

    const pack = loadBilanPack(entry.output);
    expect(pack.status).toBe('DRAFT');
    expect(pack.review).toEqual({ validatedBy: null, validatedAt: null });
    expect(pack.reporting.rag.enabled).toBe(false);
    expect(isPackEnabled(pack, {})).toBe(false);
    for (const reference of Object.values(pack.reporting.promptFiles)) {
      expect(sha256(fs.readFileSync(repositoryPath(reference.path), 'utf8'))).toBe(reference.checksum);
    }
  });

  it('keeps active sources byte-identical during two deterministic batch conversions', () => {
    const before = new Map(MANIFEST.banks.map(({ source }) => [source, sha256(fs.readFileSync(repositoryPath(source), 'utf8'))]));
    const outputs = new Map(MANIFEST.banks.map(({ output }) => [output, sha256(fs.readFileSync(repositoryPath(output), 'utf8'))]));
    expect(convertBankBatch({ manifestPath: MANIFEST_PATH })).toEqual(convertBankBatch({ manifestPath: MANIFEST_PATH }));
    for (const [source, checksum] of before) expect(sha256(fs.readFileSync(repositoryPath(source), 'utf8'))).toBe(checksum);
    for (const [output, checksum] of outputs) expect(sha256(fs.readFileSync(repositoryPath(output), 'utf8'))).toBe(checksum);
  });

  it('never selects a bank from _archive', () => {
    expect(MANIFEST.banks.every(({ source }) => !source.split('/').includes('_archive'))).toBe(true);
    expect(fs.readdirSync(repositoryPath('data/bilans/banks/_archive')).some((name) => name.includes('a76-biased'))).toBe(true);
    const archived = parseYaml(fs.readFileSync(repositoryPath(
      'data/bilans/banks/_archive/entree-terminale-maths-v1-a76-biased.yaml',
    ), 'utf8')) as SourceBank;
    const distribution = [0, 0, 0, 0];
    for (const current of archived.items) distribution[current.options!.findIndex(({ correct }) => correct)] += 1;
    expect(distribution).toEqual([18, 0, 0, 0]);
  });

  it('rejects an invalid bank atomically and preserves every output', () => {
    const temporaryRoot = repositoryPath('.tmp-wave1-batch-test');
    const sourceEntry = MANIFEST.banks[0];
    const originalOutputs = new Map(MANIFEST.banks.map(({ output }) => [
      output,
      sha256(fs.readFileSync(repositoryPath(output), 'utf8')),
    ]));
    try {
      const invalidSource = path.join(temporaryRoot, 'data/bilans/banks', `${sourceEntry.slug}.yaml`);
      fs.mkdirSync(path.dirname(invalidSource), { recursive: true });
      const invalidYaml = fs.readFileSync(repositoryPath(sourceEntry.source), 'utf8')
        .replace(/^(\s*-\s+id:\s+)\S+/m, '$1X-FRA-INV-01');
      fs.writeFileSync(invalidSource, invalidYaml, 'utf8');
      const manifestPath = path.join(temporaryRoot, 'wave1.invalid.manifest.json');
      const invalidManifest = {
        ...MANIFEST,
        banks: MANIFEST.banks.map((entry, index) => ({
          ...entry,
          source: index === 0 ? path.relative(process.cwd(), invalidSource) : entry.source,
          output: path.relative(process.cwd(), path.join(temporaryRoot, 'outputs', `${entry.slug}.json`)),
        })),
      };
      fs.writeFileSync(manifestPath, `${JSON.stringify(invalidManifest, null, 2)}\n`, 'utf8');
      expect(() => convertBankBatch({
        manifestPath: path.relative(process.cwd(), manifestPath),
        write: true,
      })).toThrow(new RegExp(`${sourceEntry.slug}:V1`));
      expect(fs.existsSync(path.join(temporaryRoot, 'outputs'))).toBe(false);
      for (const [output, checksum] of originalOutputs) {
        expect(sha256(fs.readFileSync(repositoryPath(output), 'utf8'))).toBe(checksum);
      }
    } finally {
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it('preserves scientific Unicode from both physics-chemistry YAML sources to JSON packs', () => {
    for (const { entry, bank } of ACTIVE.filter(({ bank }) => bank.subject === 'PHYSIQUE_CHIMIE')) {
      const sourceText = fs.readFileSync(repositoryPath(entry.source), 'utf8');
      const packText = fs.readFileSync(repositoryPath(entry.output), 'utf8');
      const semanticSource = JSON.stringify(bank.items);
      const symbols = [...new Set(semanticSource.match(/[₂₃₄⁰¹²³⁴⁵⁶⁷⁸⁹→⇌ΔλμΩ×·⁻⁺°]/gu) ?? [])];
      expect(symbols.length).toBeGreaterThan(0);
      for (const symbol of symbols) expect(packText).toContain(symbol);
      expect(packText).not.toContain('�');
      expect(JSON.parse(packText).questionnaire.items).toHaveLength(bank.items.length);
      expect(sourceText).not.toContain('�');
    }
  });

  it('keeps level-specific French figure and SVT immunity nodes distinct', () => {
    const nodes = new Set(ACTIVE.flatMap(({ bank }) => bank.items.map(({ nodeCpsId }) => nodeCpsId)));
    expect(nodes.has('5e.francais.lecture.figures-de-style')).toBe(true);
    expect(nodes.has('4e.francais.lexique.figures-de-style')).toBe(true);
    expect(nodes.has('3e.francais.lexique.figures-de-style')).toBe(true);
    expect(nodes.has('2de.svt.corps-humain.microbiote-defenses')).toBe(true);
    expect(nodes.has('1re.svt.immunite.reponse-innee-adaptative')).toBe(true);
  });

  it('renders a complete dashboard with seventeen active and two historical banks', () => {
    const rows = buildDashboard(MANIFEST_PATH);
    expect(rows.filter(({ kind }) => kind === 'ACTIVE')).toHaveLength(17);
    expect(rows.filter(({ kind }) => kind === 'HISTORIQUE')).toHaveLength(2);
    expect(rows.filter(({ kind }) => kind === 'ACTIVE').every(({ complete, total, nodes, status, signature, anomalies }) =>
      complete === 18 && total === 18 && nodes === 9 && status === 'DRAFT'
      && signature === 'NON_SIGNE' && anomalies.length === 0)).toBe(true);
    const command = spawnSync(path.join(process.cwd(), 'node_modules/.bin/tsx'), [
      'scripts/bilans/check-pack-completeness.ts', '--all', '--manifest', MANIFEST_PATH,
    ], { cwd: process.cwd(), encoding: 'utf8' });
    expect(command.status).toBe(0);
    expect(command.stdout).toContain('BANK_DASHBOARD=17:ACTIVE:0:BLOCKING');
    expect(command.stdout).toContain('maths-terminale-bilan-v1');
    expect(command.stdout).toContain('entree-terminale-maths-probabilites');
  });
});

describe.each(ACTIVE)('$entry.slug mock recipe', ({ entry, bank }) => {
  it('reproduces the versioned V1-V7 evidence twice without network', async () => {
    const pack = loadBilanPack(entry.output);
    const fixture = fixtureFrom(pack);
    const facts = buildRecipeFactSheets(pack.scoring.domains, bank.level as 'QUATRIEME' | 'TROISIEME' | 'SECONDE' | 'PREMIERE' | 'TERMINALE');
    const fetchSpy = jest.spyOn(global, 'fetch');
    let first;
    let second;
    try {
      first = await generateMockRecipeEvidence(facts, fixture, entry.slug, pack.subject);
      second = await generateMockRecipeEvidence(facts, fixture, entry.slug, pack.subject);
    } finally {
      fetchSpy.mockRestore();
    }
    const metricsPath = repositoryPath(`data/bilans/recipe/${entry.slug}-mock-metrics.json`);
    const packetPath = repositoryPath(`data/bilans/recipe/${entry.slug}-mock-review-packet.json`);
    if (process.env.UPDATE_WAVE1_RECIPE_EVIDENCE === '1') {
      fs.writeFileSync(metricsPath, first.metricsJson, 'utf8');
      fs.writeFileSync(packetPath, first.reviewPacketJson, 'utf8');
    }
    expect(first.metricsJson).toBe(second.metricsJson);
    expect(first.reviewPacketJson).toBe(second.reviewPacketJson);
    expect(first.metricsJson).toBe(fs.readFileSync(metricsPath, 'utf8'));
    expect(first.reviewPacketJson).toBe(fs.readFileSync(packetPath, 'utf8'));
    expect(first.metrics.validationViolations).toEqual({ V1: 0, V2: 0, V3: 0, V4: 0, V5: 0, V6: 0, V7: 0 });
    expect(first.reviewPacket.reports).toHaveLength(60);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
