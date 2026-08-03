import { access, readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

import type { FactSheet } from '../facts/fact-sheet';
import { BILAN_PRINT_BRAND } from './brand';
import { renderDeterministicBilanHtml } from './html';
import type { RenderIdentity } from './render-identity';
import type { ReportAudience } from './profile-copy';

export const BILAN_PDF_ENGINE_VERSION = 'nexus-html-chromium-pdf.v1' as const;

export type BilanPdfResult =
  | Readonly<{ status: 'AVAILABLE'; html: string; pdf: Buffer; engineVersion: typeof BILAN_PDF_ENGINE_VERSION }>
  | Readonly<{ status: 'UNAVAILABLE'; html: string; errorCode: 'BILAN_PDF_RENDER_FAILED'; engineVersion: typeof BILAN_PDF_ENGINE_VERSION }>;

export interface BilanPdfDependencies {
  renderHtmlToPdf?: (html: string) => Promise<Buffer>;
}

const ASSETS = [
  {
    logicalPath: BILAN_PRINT_BRAND.logos.header,
    filePath: ['public', 'images', 'logo_slogan_nexus_x3.png'],
    mime: 'image/png',
  },
  {
    logicalPath: BILAN_PRINT_BRAND.logos.compact,
    filePath: ['public', 'images', 'logo_nexus_reussite.png'],
    mime: 'image/png',
  },
  {
    logicalPath: BILAN_PRINT_BRAND.fonts.displayAsset,
    filePath: ['app', 'fonts', 'Fraunces-Variable.woff2'],
    mime: 'font/woff2',
  },
  {
    logicalPath: BILAN_PRINT_BRAND.fonts.bodyAsset,
    filePath: ['app', 'fonts', 'DMSans-Variable.woff2'],
    mime: 'font/woff2',
  },
] as const;

async function inlinePrintAssets(html: string): Promise<string> {
  let resolved = html;
  for (const asset of ASSETS) {
    const bytes = await readFile(path.join(process.cwd(), ...asset.filePath));
    resolved = resolved.replaceAll(asset.logicalPath, `data:${asset.mime};base64,${bytes.toString('base64')}`);
  }
  return resolved;
}

async function executableFile(candidate: string): Promise<boolean> {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function resolveChromiumExecutable(playwrightPath: string): Promise<string> {
  const configured = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (configured !== undefined) {
    if (await executableFile(configured)) return configured;
    throw new Error('BILAN_PDF_CONFIGURED_CHROMIUM_MISSING');
  }
  if (await executableFile(playwrightPath)) return playwrightPath;

  const cacheRoot = path.join(os.homedir(), '.cache', 'ms-playwright');
  const entries = await readdir(cacheRoot, { withFileTypes: true });
  const candidates = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('chromium-'))
    .map((entry) => path.join(cacheRoot, entry.name, 'chrome-linux64', 'chrome'))
    .sort()
    .reverse();
  for (const candidate of candidates) {
    if (await executableFile(candidate)) return candidate;
  }
  throw new Error('BILAN_PDF_CHROMIUM_MISSING');
}

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const resolvedHtml = await inlinePrintAssets(html);
  const { chromium } = await import('playwright');
  const executablePath = await resolveChromiumExecutable(chromium.executablePath());
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
    await page.emulateMedia({ media: 'print' });
    await page.setContent(resolvedHtml, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
  } finally {
    await browser.close();
  }
}

export async function renderDeterministicBilanPdf(
  factSheet: FactSheet,
  audience: ReportAudience,
  identity: RenderIdentity,
  dependencies: BilanPdfDependencies = {},
): Promise<BilanPdfResult> {
  const html = renderDeterministicBilanHtml(factSheet, audience, identity);
  try {
    const pdf = await (dependencies.renderHtmlToPdf ?? renderHtmlToPdf)(html);
    if (!pdf.subarray(0, 4).equals(Buffer.from('%PDF'))) throw new Error('INVALID_PDF_MAGIC');
    return Object.freeze({ status: 'AVAILABLE', html, pdf, engineVersion: BILAN_PDF_ENGINE_VERSION });
  } catch {
    return Object.freeze({
      status: 'UNAVAILABLE',
      html,
      errorCode: 'BILAN_PDF_RENDER_FAILED',
      engineVersion: BILAN_PDF_ENGINE_VERSION,
    });
  }
}

function neutralizeMatch(value: string): string {
  return value.replace(/[0-9A-Fa-f]/g, '0');
}

export function normalizePdfForComparison(pdf: Buffer): Buffer {
  const binary = pdf.toString('latin1')
    .replace(/\/(?:CreationDate|ModDate)\s*\(D:[^)]*\)/g, neutralizeMatch)
    .replace(/\/ID\s*\[\s*<[^>]*>\s*<[^>]*>\s*\]/g, neutralizeMatch);
  return Buffer.from(binary, 'latin1');
}

export async function extractPdfText(pdf: Buffer): Promise<string> {
  const script = `
    import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const document = await getDocument({ data: new Uint8Array(Buffer.concat(chunks)) }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => 'str' in item ? item.str : '').filter(Boolean).join(' '));
    }
    process.stdout.write(pages.join('\\n'));
  `;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '--eval', script], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(stdout).toString('utf8'));
      else reject(new Error(`BILAN_PDF_TEXT_EXTRACTION_FAILED:${code}:${Buffer.concat(stderr).toString('utf8').slice(0, 200)}`));
    });
    child.stdin.end(pdf);
  });
}
