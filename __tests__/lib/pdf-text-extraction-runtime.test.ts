/** @jest-environment node */

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkPdfTextExtractionRuntime } from '@/lib/core-v2/diagnostics/text-extraction';

describe('PDF text extraction runtime preflight', () => {
  test('checks that the production child helper can import the locked PDF.js engine', async () => {
    await expect(checkPdfTextExtractionRuntime({
      root: process.cwd(),
      env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', NODE_ENV: 'test' },
    })).resolves.toEqual({ available: true });
  });
});


test('recovers an unavailable engine after a bounded cooldown without probing on every drain', async () => {
  const root = mkdtempSync(join(tmpdir(), 'pdf-runtime-recovery-'));
  const folder = join(root, 'lib/bilans/render');
  mkdirSync(folder, { recursive: true });
  const countPath = join(folder, 'probe-count');
  writeFileSync(join(folder, 'pdf-text-extraction-child.mjs'), `
    import { existsSync, readFileSync, writeFileSync } from 'node:fs';
    const countPath = new URL('./probe-count', import.meta.url);
    const count = existsSync(countPath) ? Number(readFileSync(countPath, 'utf8')) + 1 : 1;
    writeFileSync(countPath, String(count));
    if (count === 1) process.exitCode = 1;
    else process.stdout.write('PDFJS_RUNTIME_AVAILABLE');
  `);
  let now = 0;
  const options = { root, now: () => now, env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', NODE_ENV: 'test' as const } };
  try {
    await expect(checkPdfTextExtractionRuntime(options)).resolves.toEqual({ available: false, code: 'PDF_TEXT_EXTRACTION_ENGINE_UNAVAILABLE' });
    now = 4_999;
    await expect(checkPdfTextExtractionRuntime(options)).resolves.toEqual({ available: false, code: 'PDF_TEXT_EXTRACTION_ENGINE_UNAVAILABLE' });
    expect(readFileSync(countPath, 'utf8')).toBe('1');
    now = 5_000;
    const recovered = await Promise.all([checkPdfTextExtractionRuntime(options), checkPdfTextExtractionRuntime(options)]);
    expect(recovered).toEqual([{ available: true }, { available: true }]);
    expect(readFileSync(countPath, 'utf8')).toBe('2');
    now = 10_000;
    await expect(checkPdfTextExtractionRuntime(options)).resolves.toEqual({ available: true });
    expect(readFileSync(countPath, 'utf8')).toBe('2');
  } finally { rmSync(root, { recursive: true, force: true }); }
});


test('keeps a persistently unavailable engine closed and shares every bounded recheck', async () => {
  const root = mkdtempSync(join(tmpdir(), 'pdf-runtime-unavailable-'));
  const folder = join(root, 'lib/bilans/render');
  mkdirSync(folder, { recursive: true });
  const countPath = join(folder, 'probe-count');
  writeFileSync(join(folder, 'pdf-text-extraction-child.mjs'), `
    import { existsSync, readFileSync, writeFileSync } from 'node:fs';
    const countPath = new URL('./probe-count', import.meta.url);
    const count = existsSync(countPath) ? Number(readFileSync(countPath, 'utf8')) + 1 : 1;
    writeFileSync(countPath, String(count));
    process.exitCode = 1;
  `);
  let now = 0;
  const options = { root, now: () => now, env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', NODE_ENV: 'test' as const } };
  const unavailable = { available: false, code: 'PDF_TEXT_EXTRACTION_ENGINE_UNAVAILABLE' };
  try {
    await expect(checkPdfTextExtractionRuntime(options)).resolves.toEqual(unavailable);
    now = 5_000;
    expect(await Promise.all([checkPdfTextExtractionRuntime(options), checkPdfTextExtractionRuntime(options)])).toEqual([unavailable, unavailable]);
    now = 9_999;
    await expect(checkPdfTextExtractionRuntime(options)).resolves.toEqual(unavailable);
    expect(readFileSync(countPath, 'utf8')).toBe('2');
    now = 10_000;
    await expect(checkPdfTextExtractionRuntime(options)).resolves.toEqual(unavailable);
    expect(readFileSync(countPath, 'utf8')).toBe('3');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
