import { assertVersionedPdfChromium } from './pdf-engine';

describe('versioned PDF Chromium contract', () => {
  it('reports the executable error when Chromium cannot be inspected', () => {
    expect(() => assertVersionedPdfChromium(() => ({
      status: null,
      stdout: null,
      stderr: null,
      error: new Error('spawn ENOENT'),
    }))).toThrow('BILAN_PDF_CHROMIUM_VERSION_MISMATCH:expected=145:actual=spawn ENOENT');
  });
});
