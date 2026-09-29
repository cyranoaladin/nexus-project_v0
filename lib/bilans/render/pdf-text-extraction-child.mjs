import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

if (process.argv.includes('--check')) {
  process.stdout.write('PDFJS_RUNTIME_AVAILABLE');
} else {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  try {
    const document = await getDocument({ data: new Uint8Array(Buffer.concat(chunks)) }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => ('str' in item ? item.str : '')).filter(Boolean).join(' '));
    }
    process.stdout.write(pages.join('\n'));
  } catch (error) {
    const errorName = error instanceof Error ? error.name : 'UNKNOWN';
    process.stderr.write(`PDFJS_DOCUMENT_EXTRACTION_FAILED:${errorName}`);
    process.exitCode = 1;
  }
}
