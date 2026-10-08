/** @jest-environment node */
import { ESLint } from 'eslint';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('effective application lint enables Next framework rules', async () => {
  const eslint = new ESLint({ cwd: process.cwd() });
  const config = await eslint.calculateConfigForFile('app/page.tsx');
  expect(config.rules['@next/next/no-head-import-in-document'][0]).toBe('error');
  expect(config.rules['@next/next/no-async-client-component'][0]).toBe('warn');
  // This project is a single Next root. The bounded dependency override
  // must never be used for glob-based monorepo root discovery.
  expect(config.settings?.next?.rootDir).toBeUndefined();
  const [syncScript] = await eslint.lintText("export default function Page() { return <script src='/synthetic.js' />; }", { filePath: resolve('app/__lint_sentinel__.tsx') });
  expect(syncScript.messages.some(message => message.ruleId === '@next/next/no-sync-scripts' && message.severity === 2)).toBe(true);
  for (const path of ['app/api/synthetic/route.ts', 'components/Synthetic.tsx', 'lib/synthetic.ts']) {
    const effective = await eslint.calculateConfigForFile(path);
    expect(effective.settings?.next?.rootDir).toBeUndefined();
  }
  const [result] = await eslint.lintText("'use client'; export default async function Page() { return <div />; }", { filePath: resolve('app/__lint_sentinel__.tsx') });
  expect(result.messages.some(message => message.ruleId === '@next/next/no-async-client-component')).toBe(true);
});

test('Next lint dependency is pinned and its unused glob dependency cannot bring braces back', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  expect(pkg.devDependencies['@next/eslint-plugin-next']).toBe('15.5.27');
  expect(pkg.overrides['@next/eslint-plugin-next']['fast-glob']).toBe('npm:tinyglobby@0.2.17');
  expect(Object.keys(lock.packages).filter(path => /node_modules\/braces$/.test(path))).toEqual([]);
});
