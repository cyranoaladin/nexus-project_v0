#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = process.cwd();
const mode = process.argv[2];
const suppliedTarget = process.argv[3];

const publicSourceRoots = [
  'components/pre-rentree-2026',
  'components/marketing/PreRentreeCampaignSpotlight.tsx',
  'components/layout/CorporateNavbar.tsx',
  'app/stages/pre-rentree-2026',
  'app/HomePageClient.tsx',
  'app/bilan-gratuit',
  'lib/campaigns/pre-rentree-2026/configurator.ts',
  'lib/analytics.ts',
];

const internalTokenPatterns = [
  /PRE_REGISTRATION_OPEN/i,
  /OWNER_INPUT_REQUIRED/i,
  /PENDING_EVIDENCE/i,
  /IMPLEMENTATION_PLAN_DEFINED/i,
  /VERIFIED_IN_TEST/i,
  /GATE-/i,
  /\b(?:M0A|M0B|M0C|M1|M2|M3|V1|V2)\b/,
  /\b(?:LEGACY|DRAFT)\b/,
  /pre2026-pack-/i,
  /MATHS_NSI_SNT_TEACHER/i,
  /FRENCH_TEACHER/i,
  /PHYSICS_CHEMISTRY_TEACHER/i,
  /WHATSAPP_PRIMARY/i,
  /logical room/i,
  /roomRole/i,
  /teacherRole/i,
  /internal note/i,
  /internal only/i,
  /\bTODO\b/i,
  /\bFIXME\b/i,
];

const copiedBusinessFactPatterns = [
  /\b(?:480|900|1350|1800|140|270|410|540|340|630|940|1260)\b/,
  /\b(?:17|28|10)\s+août\b/i,
  /\b(?:08:30|10:45|12:45|13:30|15:30|15:45|17:45)\b/,
  /\+216\s*99\s*19\s*28\s*29|21699192829/,
  /\b(?:3\s+à\s+5|de\s+3\s+à\s+5|minimum\s+3|maximum\s+5)\s+élèves?\b/i,
];

function filesUnder(path) {
  if (!existsSync(path)) return [];
  const stat = statSync(path);
  if (stat.isFile()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory() ? filesUnder(child) : [child];
  });
}

function isTextFile(path) {
  return ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.html', '.txt', '.rsc'].includes(extname(path));
}

function scan(files, patterns, category, stripStyleTokens = false) {
  const findings = [];
  for (const file of files.filter(isTextFile)) {
    const stat = statSync(file);
    if (stat.size > 15_000_000) continue;
    const rawContent = readFileSync(file, 'utf8');
    const content = stripStyleTokens
      ? rawContent.replace(/className=(?:"[^"]*"|'[^']*'|\{`[^`]*`\})/g, '')
      : rawContent;
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(content);
      if (!match) continue;
      const line = content.slice(0, match.index).split('\n').length;
      findings.push(`${category}: ${relative(root, file)}:${line}: ${match[0]}`);
    }
  }
  return findings;
}

function relevantArtifactFiles(nextRoot) {
  const staticPath = '.next/static';
  const serverPath = '.next/server';
  const staticFiles = filesUnder(join(nextRoot, staticPath.replace('.next/', '')));
  const serverTargets = [
    join(nextRoot, serverPath.replace('.next/', ''), 'app/page'),
    join(nextRoot, serverPath.replace('.next/', ''), 'app/stages/pre-rentree-2026'),
    join(nextRoot, serverPath.replace('.next/', ''), 'app/bilan-gratuit'),
  ].flatMap(filesUnder);
  return [...staticFiles, ...serverTargets];
}

let files = [];
let includeBusinessFacts = false;

if (mode === '--source') {
  files = publicSourceRoots.flatMap((path) => filesUnder(resolve(root, path)));
  includeBusinessFacts = true;
} else if (mode === '--artifacts') {
  const nextRoot = resolve(root, suppliedTarget ?? '.next');
  files = relevantArtifactFiles(nextRoot);
} else if (mode === '--rendered') {
  if (!suppliedTarget) {
    throw new Error('Usage: final-public-release-audit.mjs --rendered <capture-directory>');
  }
  files = filesUnder(resolve(root, suppliedTarget));
} else {
  throw new Error('Usage: final-public-release-audit.mjs --source | --artifacts [next-directory] | --rendered <capture-directory>');
}

const findings = scan(files, internalTokenPatterns, 'internal-token');
if (includeBusinessFacts) {
  findings.push(...scan(files, copiedBusinessFactPatterns, 'copied-business-fact', true));
}

if (findings.length > 0) {
  process.stderr.write(`${findings.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Pré-rentrée public release scan: ${files.length} files checked, 0 finding.\n`);
}
