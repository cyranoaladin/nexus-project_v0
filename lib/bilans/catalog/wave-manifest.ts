import fs from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

const bankEntrySchema = z.object({
  slug: z.string().trim().min(1),
  source: z.string().trim().min(1),
  cps: z.union([
    z.string().trim().min(1),
    z.array(z.string().trim().min(1)).min(1),
  ]),
  promptDirectory: z.string().trim().min(1),
  output: z.string().trim().min(1),
}).strict();

const historicalEntrySchema = z.object({
  slug: z.string().trim().min(1),
  source: z.string().trim().min(1),
  format: z.enum(['pack-json', 'metadata-yaml']),
}).strict();

export const waveManifestSchema = z.object({
  schemaVersion: z.literal('nexus-bilan-bank-wave/v1'),
  wave: z.string().trim().min(1),
  expectedActiveBanks: z.number().int().positive(),
  expectedItems: z.number().int().positive(),
  banks: z.array(bankEntrySchema).min(1),
  historical: z.array(historicalEntrySchema),
}).strict();

export type WaveManifest = z.infer<typeof waveManifestSchema>;
export type WaveBankEntry = WaveManifest['banks'][number];

export function repositoryPath(requestedPath: string): string {
  const root = process.cwd();
  const resolved = path.resolve(root, requestedPath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error('PATH_OUTSIDE_REPOSITORY');
  return resolved;
}

export function loadWaveManifest(relativePath: string): WaveManifest {
  const manifest = waveManifestSchema.parse(JSON.parse(fs.readFileSync(repositoryPath(relativePath), 'utf8')));
  const slugs = manifest.banks.map(({ slug }) => slug);
  if (new Set(slugs).size !== slugs.length) throw new Error('WAVE_MANIFEST_DUPLICATE_SLUG');
  for (const entry of manifest.banks) {
    if (entry.source.split(/[\\/]/).includes('_archive')) throw new Error(`WAVE_MANIFEST_ARCHIVE_FORBIDDEN:${entry.slug}`);
    if (!entry.source.endsWith(`/${entry.slug}.yaml`) || !entry.output.endsWith(`/${entry.slug}.json`)) {
      throw new Error(`WAVE_MANIFEST_PATH_MISMATCH:${entry.slug}`);
    }
  }
  return manifest;
}
