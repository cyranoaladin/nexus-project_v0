import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const { parse: parseYaml } = require(path.join(
  path.dirname(require.resolve('yaml/package.json')),
  'dist/index.js',
)) as typeof import('yaml');

import {
  type CpsCatalog,
  type SourceBank,
  validateBankCollection,
} from '@/lib/bilans/catalog/bank-validation';
import {
  loadWaveManifest,
  repositoryPath,
  type WaveBankEntry,
} from '@/lib/bilans/catalog/wave-manifest';

import { buildPack, resolveCpsCatalog } from './yaml-bank-to-pack';

const DEFAULT_MANIFEST = 'data/bilans/banks/wave1.manifest.json';
const TEMPLATE_PACK = 'data/bilans/banks/maths-terminale-bilan-v1.json';

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function source(entry: WaveBankEntry): Readonly<{ bank: SourceBank; catalog: CpsCatalog; checksum: string }> {
  const text = fs.readFileSync(repositoryPath(entry.source), 'utf8');
  const bank = parseYaml(text) as SourceBank;
  return {
    bank,
    catalog: resolveCpsCatalog(bank, entry.cps),
    checksum: sha256(text),
  };
}

export type BatchBankResult = Readonly<{
  slug: string;
  items: number;
  nodes: number;
  sourceChecksum: string;
  outputChecksum: string;
}>;

export function convertBankBatch(options: Readonly<{
  manifestPath?: string;
  write?: boolean;
}> = {}): readonly BatchBankResult[] {
  const manifest = loadWaveManifest(options.manifestPath ?? DEFAULT_MANIFEST);
  const loaded = manifest.banks.map((entry) => ({ entry, ...source(entry) }));
  const failures = validateBankCollection(loaded);
  const itemCount = loaded.reduce((sum, { bank }) => sum + bank.items.length, 0);
  if (manifest.banks.length !== manifest.expectedActiveBanks) {
    throw new Error(`BANK_BATCH_INVALID\nBATCH:COUNT:${manifest.banks.length}/${manifest.expectedActiveBanks}`);
  }
  if (itemCount !== manifest.expectedItems) failures.push({
    slug: manifest.wave,
    rule: 'BATCH',
    path: '$.items',
    message: `${itemCount}/${manifest.expectedItems}`,
  });
  if (failures.length > 0) {
    throw new Error(`BANK_BATCH_INVALID\n${failures.map(({ slug, rule, path: itemPath, message }) => `${slug}:${rule}:${itemPath}:${message}`).join('\n')}`);
  }

  const built = loaded.map(({ entry, bank, checksum }) => {
    const pack = buildPack({
      sourcePath: entry.source,
      cpsPath: entry.cps,
      templatePackPath: TEMPLATE_PACK,
      promptDirectory: entry.promptDirectory,
    });
    const bytes = `${JSON.stringify(pack, null, 2)}\n`;
    return {
      entry,
      bytes,
      result: Object.freeze({
        slug: bank.slug,
        items: bank.items.length,
        nodes: new Set(bank.items.map(({ nodeCpsId }) => nodeCpsId)).size,
        sourceChecksum: checksum,
        outputChecksum: sha256(bytes),
      }),
    };
  });

  for (const { entry, result } of built) {
    const current = sha256(fs.readFileSync(repositoryPath(entry.source), 'utf8'));
    if (current !== result.sourceChecksum) throw new Error(`BANK_SOURCE_CHANGED_DURING_BATCH:${entry.slug}`);
  }

  if (options.write === true) {
    for (const { entry, bytes } of built) {
      const output = repositoryPath(entry.output);
      fs.mkdirSync(path.dirname(output), { recursive: true });
      const temporary = `${output}.batch.tmp`;
      fs.writeFileSync(temporary, bytes, 'utf8');
      fs.renameSync(temporary, output);
    }
  }
  return Object.freeze(built.map(({ result }) => result));
}

export function main(args: string[]): number {
  const manifestIndex = args.indexOf('--manifest');
  const manifestPath = manifestIndex >= 0 ? args[manifestIndex + 1] : DEFAULT_MANIFEST;
  const write = args.includes('--write');
  if (manifestPath === undefined || args.some((value, index) => value.startsWith('--')
    && value !== '--manifest' && value !== '--write' && index !== manifestIndex + 1)) {
    console.error('Usage: tsx scripts/bilans/convert-bank-batch.ts [--manifest <manifest.json>] [--write]');
    return 2;
  }
  try {
    const results = convertBankBatch({ manifestPath, write });
    for (const result of results) console.log(`BANK_OK=${result.slug}:${result.items}:${result.nodes}:${result.outputChecksum}`);
    console.log(`BANK_BATCH_OK=${results.length}:${results.reduce((sum, result) => sum + result.items, 0)}:${write ? 'WRITTEN' : 'CHECK_ONLY'}`);
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
