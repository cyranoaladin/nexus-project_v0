#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = process.cwd();
const mode = process.argv[2];
const suppliedTarget = process.argv[3];

const publicSourceRoots = [
  'components/pre-rentree-2026/CanonicalOfferCatalogue.tsx',
  'components/pre-rentree-2026/CampaignFAQ.tsx',
  'components/pre-rentree-2026/CampaignPageTracker.tsx',
  'components/marketing/PreRentreeCampaignSpotlight.tsx',
  'components/layout/CorporateNavbar.tsx',
  'app/stages/pre-rentree-2026',
  'app/stages/page.tsx',
  'app/stages/Stages2026Page.tsx',
  'app/offres/page.tsx',
  'app/accompagnement-scolaire/page.tsx',
  'app/HomePageClient.tsx',
  'lib/analytics.ts',
];

const internalTokenPatterns = [
  /PRE_REGISTRATION_OPEN/i,
  /OWNER_INPUT_REQUIRED/i,
  /PENDING_EVIDENCE/i,
  /IMPLEMENTATION_PLAN_DEFINED/i,
  /VERIFIED_IN_TEST/i,
  /GATE-/i,
  /["'`](?:M0A|M0B|M0C|M1|M2|M3|V1|V2)["'`]/,
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

// Reviewed, justified exceptions for --artifacts: matches that are either (a)
// third-party library code (NextAuth, Tailwind) inlined by webpack directly
// into an app chunk rather than split into a separate vendor file — file-path
// exclusion (isVendorOrFrameworkChunk) can't catch these — or (b) Nexus's own
// legitimate internal-status -> public-French-label translation tables (the
// enum KEY must exist in the bundle for the lookup to work; what matters is
// that only the mapped LABEL, never the raw key, reaches visible text — which
// __tests__/campaigns and the rendered-mode audits already check separately).
// Each entry is matched against the finding's own surrounding context, not
// just the bare token, so a NEW, unrelated occurrence of the same word still
// triggers a real finding. See docs/audits/2026-07-29-existing-auditors-inventory.md.
// Each entry: [signature, reason, date reviewed]. No entry may be added
// without a reason and a date — an unreasoned exception is a permanent hole.
const ARTIFACT_KNOWN_EXCEPTIONS_DATED = [
  ['the config object is internal only', '@auth/core (NextAuth), vendor code inlined by webpack', '2026-07-29'],
  ['@todo class group will be renamed', "Tailwind CSS's own utility generator comment", '2026-07-29'],
  ['/** @todo */ class ClientFetchError', '@auth/core (NextAuth), vendor code inlined by webpack', '2026-07-29'],
  ["PRE_REGISTRATION_OPEN: 'Pré-inscriptions ouvertes'", "Nexus's own status->label map; only the label is ever displayed", '2026-07-29'],
  ["DRAFT: 'Campagne en préparation'", 'same map, same reasoning', '2026-07-29'],
];
const ARTIFACT_KNOWN_EXCEPTIONS = ARTIFACT_KNOWN_EXCEPTIONS_DATED.map(([signature]) => signature);

function scan(files, patterns, category, stripStyleTokens = false, { exceptions = [] } = {}) {
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
      const context = content.slice(Math.max(0, match.index - 80), match.index + match[0].length + 80);
      if (exceptions.some((signature) => context.includes(signature))) continue;
      const line = content.slice(0, match.index).split('\n').length;
      findings.push(`${category}: ${relative(root, file)}:${line}: ${match[0]}`);
    }
  }
  return findings;
}

// Shared framework/vendor chunks (webpack runtime, React, polyfills, npm
// package bundles) are needed to load ANY page and legitimately contain
// strings like "TODO" inside minified third-party code — noise, not an
// application-content leak. Excluded from --artifacts regardless of which
// path built the file list (manifest-driven or the static fallback), since
// Next.js's own app-build-manifest.json page entries already include these
// shared chunks alongside the page's own code.
function isVendorOrFrameworkChunk(filePath) {
  const base = filePath.split('/').pop() ?? '';
  return /^(webpack|framework|main-app|main|polyfills)[-.]/.test(base)
    || base === 'webpack.js'
    || filePath.includes('/chunks/node_modules');
}

function relevantArtifactFiles(nextRoot) {
  const staticPath = '.next/static';
  const serverPath = '.next/server';
  const appBuildManifestPath = join(nextRoot, 'app-build-manifest.json');
  const routeKeys = ['/page', '/layout', '/stages/pre-rentree-2026/page'];
  const browserFiles = (existsSync(appBuildManifestPath)
    ? [...new Set(routeKeys.flatMap((route) => {
        const manifest = JSON.parse(readFileSync(appBuildManifestPath, 'utf8'));
        return (manifest.pages?.[route] ?? []).map((file) => join(nextRoot, file));
      }))].filter(existsSync)
    : [
        join(nextRoot, staticPath.replace('.next/', ''), 'chunks/app/page'),
        join(nextRoot, staticPath.replace('.next/', ''), 'chunks/app/layout'),
        join(nextRoot, staticPath.replace('.next/', ''), 'chunks/app/stages/pre-rentree-2026'),
      ].flatMap(filesUnder)
  ).filter((file) => !isVendorOrFrameworkChunk(file));
  const serverFiles = [
    join(nextRoot, serverPath.replace('.next/', ''), 'app/page'),
    join(nextRoot, serverPath.replace('.next/', ''), 'app/stages/pre-rentree-2026'),
  ].flatMap(filesUnder).filter((file) => !isVendorOrFrameworkChunk(file));
  return { browserFiles, serverFiles };
}

let files = [];
let includeBusinessFacts = false;
let classifiedServerFindings = [];

if (mode === '--source') {
  files = publicSourceRoots.flatMap((path) => filesUnder(resolve(root, path)));
  includeBusinessFacts = true;
} else if (mode === '--artifacts') {
  const nextRoot = resolve(root, suppliedTarget ?? '.next');
  const artifacts = relevantArtifactFiles(nextRoot);
  files = artifacts.browserFiles;
  classifiedServerFindings = scan(artifacts.serverFiles, internalTokenPatterns, 'server-only', false, { exceptions: ARTIFACT_KNOWN_EXCEPTIONS });
} else if (mode === '--rendered') {
  if (!suppliedTarget) {
    throw new Error('Usage: final-public-release-audit.mjs --rendered <capture-directory>');
  }
  files = filesUnder(resolve(root, suppliedTarget));
} else {
  throw new Error('Usage: final-public-release-audit.mjs --source | --artifacts [next-directory] | --rendered <capture-directory>');
}

if (classifiedServerFindings.length > 0) {
  process.stdout.write(
    `Pré-rentrée server artifacts classified as non-browser code: ${classifiedServerFindings.length} occurrences.\n`,
  );
}

const findings = scan(files, internalTokenPatterns, 'internal-token', false, {
  exceptions: mode === '--artifacts' ? ARTIFACT_KNOWN_EXCEPTIONS : [],
});
if (includeBusinessFacts) {
  findings.push(...scan(files, copiedBusinessFactPatterns, 'copied-business-fact', true));
}

if (findings.length > 0) {
  process.stderr.write(`${findings.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Pré-rentrée public release scan: ${files.length} files checked, 0 finding.\n`);
}
