/**
 * extractSubmissionTextBounded — pure unit tests, no DB. Mission §6: a
 * resource cap on stored text must stay a visible fact (`truncated`,
 * `totalCharacterCount`), never a silent edit that lets a truncated
 * answer pass for a complete one.
 */
import { extractSubmissionTextBounded } from '@/lib/core-v2/diagnostics/text-extraction';
import { renderHtmlToPdf } from '@/lib/bilans/render/pdf';

describe('extractSubmissionTextBounded', () => {
  test('empty buffer is an explicit FAILED, never treated as a real file', async () => {
    const result = await extractSubmissionTextBounded(Buffer.alloc(0));
    expect(result).toEqual({ status: 'FAILED', errorMessage: 'EMPTY_FILE' });
  });

  test('oversized buffer is refused before any extraction is attempted', async () => {
    const oversized = Buffer.alloc(16 * 1024 * 1024, 0x25); // 16 MiB, byte value irrelevant
    const result = await extractSubmissionTextBounded(oversized);
    expect(result.status).toBe('FAILED');
    expect(result).toMatchObject({ errorMessage: expect.stringContaining('FILE_TOO_LARGE') });
  });

  test('a corrupt/unreadable PDF is an explicit FAILED, never a fabricated result', async () => {
    const result = await extractSubmissionTextBounded(Buffer.from('this is not a PDF at all'));
    expect(result.status).toBe('FAILED');
  });

  test('a real PDF with real text under the cap: SUCCEEDED, not truncated, counts match exactly', async () => {
    const pdf = await renderHtmlToPdf('<html><body><p>Réponse courte, sous la limite.</p></body></html>');
    const result = await extractSubmissionTextBounded(pdf);
    expect(result.status).toBe('SUCCEEDED');
    if (result.status !== 'SUCCEEDED') throw new Error('unreachable');
    expect(result.truncated).toBe(false);
    expect(result.characterCount).toBe(result.totalCharacterCount);
    expect(result.text).toContain('Réponse courte');
  });

  test('a real PDF whose text exceeds the cap: SUCCEEDED but explicitly truncated, with the real pre-cap length preserved', async () => {
    const longParagraph = 'Réponse longue répétée. '.repeat(20); // real, non-trivial text
    const pdf = await renderHtmlToPdf(`<html><body><p>${longParagraph}</p></body></html>`);

    // A small override makes this deterministic and fast — no need to
    // render a genuinely 200k-character PDF to prove the same logic.
    const result = await extractSubmissionTextBounded(pdf, { maxStoredTextChars: 50 });
    expect(result.status).toBe('SUCCEEDED');
    if (result.status !== 'SUCCEEDED') throw new Error('unreachable');
    expect(result.truncated).toBe(true);
    expect(result.characterCount).toBe(50);
    expect(result.text).toHaveLength(50);
    expect(result.totalCharacterCount).toBeGreaterThan(50); // the real, un-truncated length is preserved as a fact
    expect(result.text).toBe(longParagraph.trim().slice(0, 50));
  });

  test('a genuinely textless PDF is EMPTY, never a fabricated success', async () => {
    const pdf = await renderHtmlToPdf('<html><body></body></html>');
    const result = await extractSubmissionTextBounded(pdf);
    expect(result).toEqual({ status: 'EMPTY' });
  });
});
