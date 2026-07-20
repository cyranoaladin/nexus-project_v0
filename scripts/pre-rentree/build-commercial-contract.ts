import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { compileCommercialPublicationContract } from '@/lib/campaigns/pre-rentree-2026/commercial-contract';

function readArgument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

const output = resolve(readArgument('--output'));
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(compileCommercialPublicationContract(), null, 2)}\n`, 'utf8');
