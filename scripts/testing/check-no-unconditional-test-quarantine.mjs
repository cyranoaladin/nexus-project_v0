#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const self = 'scripts/testing/check-no-unconditional-test-quarantine.mjs';
const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter((file) => /\.(?:[cm]?[jt]sx?|py)$/.test(file))
  .filter((file) => existsSync(file))
  .filter((file) => file !== self);

const forbidden = [
  { label: 'suite ignorée', pattern: /\b(?:test|describe)\.describe\.skip\s*\(|\bdescribe\.skip\s*\(/g },
  { label: 'test ignoré sans condition', pattern: /\b(?:test|it)\.skip\s*\(\s*(?:true\b|["'`]|\))/g },
  { label: 'test marqué fixme', pattern: /\b(?:test|it)\.fixme\s*\(/g },
  { label: 'test marqué todo', pattern: /\b(?:test|it)\.todo\s*\(/g },
  { label: 'alias de quarantaine', pattern: /\b(?:xit|xdescribe)\s*\(/g },
  { label: 'focus interdit', pattern: /\b(?:test|it|describe)\.only\s*\(/g },
  { label: 'skip pytest impératif', pattern: /\bpytest\.skip\s*\(/g },
  { label: 'skip pytest décorateur', pattern: /\bpytest\.mark\.skip(?:if)?\b/g },
];

const policyProbes = [
  ['suite ignorée', "describe.skip('suite', () => {})"],
  ['test ignoré sans condition', "test.skip(true, 'later')"],
  ['test marqué fixme', "test.fixme('broken', () => {})"],
  ['test marqué todo', "test.todo('missing')"],
  ['alias de quarantaine', "xit('later', () => {})"],
  ['focus interdit', "test.only('focused', () => {})"],
  ['skip pytest impératif', "pytest.skip('later')"],
  ['skip pytest décorateur', '@pytest.mark.skip'],
];

for (const [label, source] of policyProbes) {
  const rule = forbidden.find((candidate) => candidate.label === label);
  const probePattern = rule && new RegExp(rule.pattern.source, rule.pattern.flags.replace('g', ''));
  if (!probePattern?.test(source)) {
    console.error(`Le garde de quarantaine ne détecte plus sa sonde interne: ${label}`);
    process.exit(1);
  }
}

const violations = [];
for (const file of tracked) {
  const source = readFileSync(file, 'utf8');
  for (const { label, pattern } of forbidden) {
    for (const match of source.matchAll(pattern)) {
      const line = source.slice(0, match.index).split('\n').length;
      violations.push(`${file}:${line}: ${label}`);
    }
  }
}

if (violations.length > 0) {
  console.error('Quarantaines inconditionnelles/focus interdits détectés :');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`OK: ${tracked.length} fichiers suivis sans quarantaine inconditionnelle ni focus.`);
