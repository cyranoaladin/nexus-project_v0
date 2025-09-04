import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3003';

// Minimal fake buffers to exercise pipeline without real conversion content.
const DOCX_BUFFER = Buffer.from([0x50,0x4b,0x03,0x04,0x14,0x00,0x06,0x00,0x08,0x00]); // zip header (docx is zip)
const JPG_BUFFER = Buffer.from([0xff,0xd8,0xff,0xd9]); // minimal JPEG markers (will likely fail OCR gracefully)

function multipart(file:{name:string;mimeType:string;buffer:Buffer}){
  // Playwright request API supports multipart via data: {file} in some runners,
  // here we emulate standard form-data posting with fetch-like shim.
  return {
    formData: { file },
  } as any;
}

test.describe('RAG ingestion DOCX & OCR', () => {
  test('DOCX upload → search returns hit (text fallback)', async ({ request }) => {
    const up = await request.post(`${BASE}/api/rag/upload`, {
      multipart: { file: { name: 'cours_nsi.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: DOCX_BUFFER } } as any,
    } as any);
    expect(up.ok()).toBeTruthy();
    const js = await up.json();
    expect(js.ok).toBeTruthy();

    const search = await request.get(`${BASE}/api/rag/search?q=Document&k=3`);
    expect(search.ok()).toBeTruthy();
    const data = await search.json();
    expect(Array.isArray(data.hits)).toBeTruthy();
    // meta.docType should be 'docx' for at least one recent entry
    const hasDocx = data.hits.some((h: any) => (h.meta?.docType || '').toLowerCase() === 'docx');
    expect(hasDocx).toBeTruthy();
  });

  test('OCR image upload (flag on) → search finds generic text', async ({ request }) => {
    // Flag OCR on (best-effort in E2E)
    process.env.RAG_OCR_ENABLED = '1';
    const up = await request.post(`${BASE}/api/rag/upload`, {
      multipart: { file: { name: 'scan.jpg', mimeType: 'image/jpeg', buffer: JPG_BUFFER } } as any,
    } as any);
    expect(up.ok()).toBeTruthy();

    const search = await request.get(`${BASE}/api/rag/search?q=Image&k=3`);
    expect(search.ok()).toBeTruthy();
    const data = await search.json();
    const hasOCR = data.hits.some((h: any) => (h.meta?.docType || '').toLowerCase() === 'ocr');
    expect(hasOCR).toBeTruthy();
  });
});

