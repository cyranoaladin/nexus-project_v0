#!/usr/bin/env node

import { AxeBuilder } from '@axe-core/playwright';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:3012';
const output = resolve(
  process.argv[3] ?? 'assets/qa/pre-rentree-2026/final-public-candidate',
);
const sourceSha = process.env.PRE_RENTREE_QA_SOURCE_SHA;
if (!sourceSha || !/^[0-9a-f]{40}$/.test(sourceSha)) {
  throw new Error('PRE_RENTREE_QA_SOURCE_SHA must be the tested 40-character Git SHA');
}
const route = '/stages/pre-rentree-2026';
const viewports = [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablette-768', width: 768, height: 1024 },
  { name: 'desktop-1440', width: 1440, height: 1000 },
];

await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const reports = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const screenshotPath = resolve(output, `${viewport.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const inspection = await page.evaluate(() => ({
      title: document.title,
      h1: [...document.querySelectorAll('h1')].map((element) => element.textContent?.trim()),
      headings: [...document.querySelectorAll('h1, h2, h3')]
        .map((element) => element.textContent?.replace(/\s+/g, ' ').trim())
        .filter(Boolean),
      ctas: [...document.querySelectorAll('a')]
        .map((element) => ({
          label: element.textContent?.replace(/\s+/g, ' ').trim(),
          href: element.getAttribute('href'),
        }))
        .filter(({ label }) => label),
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    }));
    const axe = await new AxeBuilder({ page }).analyze();
    reports.push({
      viewport,
      httpStatus: response?.status() ?? null,
      screenshot: `${viewport.name}.png`,
      consoleErrors,
      inspection,
      seriousOrCriticalViolations: axe.violations
        .filter(({ impact }) => impact === 'serious' || impact === 'critical')
        .map(({ id, impact, help, nodes }) => ({
          id,
          impact,
          help,
          nodeCount: nodes.length,
        })),
      contrastViolations: axe.violations
        .filter(({ id }) => id === 'color-contrast')
        .map(({ impact, help, nodes }) => ({
          impact,
          help,
          nodeCount: nodes.length,
          targets: nodes.map(({ target }) => target),
        })),
    });
    await context.close();
  }
} finally {
  await browser.close();
}

const cards = [];
for (const viewport of viewports) {
  const input = resolve(output, `${viewport.name}.png`);
  const image = sharp(input);
  const metadata = await image.metadata();
  const width = 360;
  const height = Math.round((metadata.height ?? 1) * width / (metadata.width ?? width));
  const resized = await image.resize({ width }).png().toBuffer();
  cards.push({ name: viewport.name, image: resized, width, height });
}
const gap = 24;
const labelHeight = 42;
const sheetWidth = cards.reduce((sum, card) => sum + card.width, 0) + gap * (cards.length + 1);
const sheetHeight = Math.max(...cards.map(({ height }) => height)) + labelHeight + gap * 2;
let left = gap;
const composites = [];
for (const card of cards) {
  composites.push({
    input: Buffer.from(
      `<svg width="${card.width}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#071A3A"/><text x="16" y="27" fill="#FFFFFF" font-family="sans-serif" font-size="16" font-weight="700">${card.name}</text></svg>`,
    ),
    left,
    top: gap,
  });
  composites.push({ input: card.image, left, top: gap + labelHeight });
  left += card.width + gap;
}
await sharp({
  create: {
    width: sheetWidth,
    height: sheetHeight,
    channels: 3,
    background: '#F7F3EA',
  },
}).composite(composites).png().toFile(resolve(output, 'page-responsive-contact-sheet.png'));

const report = {
  schemaVersion: '1.0.0',
  campaignId: 'pre-rentree-2026',
  purpose: 'CONTROLLED_PUBLIC_CANDIDATE_QA',
  sourceSha,
  releaseGateOverride: 'TEMPORARY_PUBLIC_READY_OUTSIDE_GIT',
  route,
  capturedAt: '2026-07-26',
  timezone: 'Africa/Tunis',
  reports,
};
await writeFile(
  resolve(output, 'browser-inspection.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);

if (reports.some(({ httpStatus }) => httpStatus !== 200)
  || reports.some(({ consoleErrors }) => consoleErrors.length > 0)
  || reports.some(({ inspection }) => inspection.horizontalOverflow)
  || reports.some(({ seriousOrCriticalViolations }) => seriousOrCriticalViolations.length > 0)) {
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    status: 'PUBLIC_CANDIDATE_VISUAL_QA_CAPTURED',
    viewports: reports.length,
    output,
  }));
}
