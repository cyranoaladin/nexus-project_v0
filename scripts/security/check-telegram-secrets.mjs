#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const scanRoot = resolve(process.argv[2] ?? process.cwd());
const ignoredDirectories = new Set([
  '.git',
  'node_modules',
  'coverage',
  'playwright-report',
  'test-results',
]);
const nonBrowserNextBuildPrefixes = [
  '.next/server',
  '.next/standalone',
  '.next/cache',
  '.next/diagnostics',
  '.next/types',
];
const findings = [];
const publicTelegramVariable = ['NEXT', 'PUBLIC', 'TELEGRAM'].join('_');
const legacyOptOutFlag = ['TELEGRAM', 'DISABLED'].join('_');
const tokenVariable = ['TELEGRAM', 'BOT', 'TOKEN'].join('_');

const rules = [
  { code: 'telegram-bot-token', pattern: /\b[0-9]{8,16}:[A-Za-z0-9_-]{30,64}\b/gu },
  { code: 'public-telegram-variable', pattern: new RegExp(`${publicTelegramVariable}[A-Z_]*`, 'gu') },
  { code: 'legacy-telegram-opt-out', pattern: new RegExp(legacyOptOutFlag, 'gu') },
  {
    code: 'telegram-token-fallback',
    pattern: new RegExp(`${tokenVariable}[^\\n]{0,80}(?:\\|\\||\\?\\?)`, 'gu'),
  },
];

function record(file, content, code, pattern) {
  pattern.lastIndex = 0;
  let match = pattern.exec(content);
  while (match) {
    const line = content.slice(0, match.index).split('\n').length;
    findings.push({ file: relative(scanRoot, file) || '.', line, code });
    match = pattern.exec(content);
  }
}

function inspectFile(file) {
  const buffer = readFileSync(file);
  if (buffer.includes(0)) return;
  const content = buffer.toString('utf8');
  for (const rule of rules) record(file, content, rule.code, rule.pattern);

  const normalized = file.replaceAll('\\', '/');
  if (!normalized.endsWith('/lib/telegram/client.ts')) {
    record(
      file,
      content,
      'direct-telegram-bot-api-call',
      /api\.telegram\.org\/bot(?:\$\{|[^\s/]*token)/giu,
    );
  }
}

function walk(target) {
  const targetStat = statSync(target, { throwIfNoEntry: false });
  if (!targetStat) return;
  if (targetStat.isFile()) {
    inspectFile(target);
    return;
  }
  if (!targetStat.isDirectory()) return;

  const relativeTarget = relative(scanRoot, target).replaceAll('\\', '/');
  if (nonBrowserNextBuildPrefixes.some(
    (prefix) => relativeTarget === prefix || relativeTarget.startsWith(`${prefix}/`),
  )) return;

  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    walk(resolve(target, entry.name));
  }
}

walk(scanRoot);

if (findings.length > 0) {
  const unique = [...new Map(
    findings.map((finding) => [`${finding.file}:${finding.line}:${finding.code}`, finding]),
  ).values()];
  for (const finding of unique) {
    process.stderr.write(`${finding.file}:${finding.line}: ${finding.code}\n`);
  }
  process.exit(1);
}

process.stdout.write('Telegram secret scan passed\n');
