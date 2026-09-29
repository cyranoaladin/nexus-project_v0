import { checkPdfTextExtractionRuntime } from '@/lib/core-v2/diagnostics/text-extraction';

describe('PDF text extraction runtime preflight', () => {
  test('checks that the production child helper can import the locked PDF.js engine', async () => {
    await expect(checkPdfTextExtractionRuntime({
      root: process.cwd(),
      env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', NODE_ENV: 'test' },
    })).resolves.toEqual({ available: true });
  });
});
