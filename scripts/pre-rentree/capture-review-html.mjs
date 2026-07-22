#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';


function argument(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`Missing required argument: ${name}`);
  return process.argv[index + 1];
}


async function capture(htmlPath, outputPath) {
  const html = resolve(htmlPath);
  const output = resolve(outputPath);
  await mkdir(output, { recursive: true });
  const source = await readFile(html, 'utf8');
  const remoteDependencies = [
    ...source.matchAll(/<(?:script|link|img|source|video)\b[^>]*(?:src|href|poster)=["']https?:\/\/[^"']+/gi),
  ].map((match) => match[0]);
  const javascriptDependencies = [...source.matchAll(/<script\b/gi)].length;

  const browser = await chromium.launch({ headless: true });
  try {
    const url = pathToFileURL(html).href;
    const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const desktop = await desktopContext.newPage();
    await desktop.goto(url, { waitUntil: 'load' });
    await desktop.evaluate(() => document.fonts.ready);
    const axe = await new AxeBuilder({ page: desktop }).analyze();
    await desktop.screenshot({ path: resolve(output, 'guide-desktop.png'), fullPage: true });

    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const mobile = await mobileContext.newPage();
    await mobile.goto(url, { waitUntil: 'load' });
    await mobile.evaluate(() => document.fonts.ready);
    const overflow = await mobile.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
    await mobile.screenshot({ path: resolve(output, 'guide-mobile.png'), fullPage: true });

    const report = {
      HTML_FILE: basename(html),
      AUTOMATED_BROWSER_ACCESSIBILITY_CHECK:
        axe.violations.length === 0 && remoteDependencies.length === 0 && javascriptDependencies === 0 && overflow === 0
          ? 'PASS'
          : 'FAIL',
      AXE_VIOLATION_COUNT: axe.violations.length,
      AXE_VIOLATIONS: axe.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        description: violation.description,
        targets: violation.nodes.map((node) => node.target),
      })),
      REMOTE_DEPENDENCY_COUNT: remoteDependencies.length,
      REMOTE_DEPENDENCIES: remoteDependencies,
      JAVASCRIPT_DEPENDENCY_COUNT: javascriptDependencies,
      MOBILE_HORIZONTAL_OVERFLOW_PX: overflow,
      SCREENSHOTS: ['guide-desktop.png', 'guide-mobile.png'],
    };
    await writeFile(
      resolve(output, 'browser-accessibility-report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8',
    );
    if (report.AUTOMATED_BROWSER_ACCESSIBILITY_CHECK !== 'PASS') process.exitCode = 1;
    return report;
  } finally {
    await browser.close();
  }
}


const report = await capture(argument('--html'), argument('--output'));
process.stdout.write(`${JSON.stringify(report)}\n`);
