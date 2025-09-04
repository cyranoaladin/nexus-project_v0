import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { id: string; }; }) {
  const id = params.id;
  const url = new URL(req.url);
  const variant = url.searchParams.get('variant');
  const niveau = url.searchParams.get('niveau');
  const dev = url.searchParams.get('dev');
  // En E2E/dev, retourner directement un PDF (éviter les redirections et hôtes internes)
  if (process.env.E2E === '1' || process.env.NEXT_PUBLIC_E2E === '1' || dev === '1') {
    try {
      const pdfLib = await import('pdf-lib');
      const { PDFDocument, StandardFonts } = pdfLib as any;
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
      for (let p = 0; p < 3; p++) {
        const page = pdfDoc.addPage([595.28, 841.89]);
        const { height } = page.getSize();
        page.drawText(`Bilan E2E PDF — ${id} — ${variant || ''} ${niveau || ''} — Page ${p + 1}`.trim(), { x: 40, y: height - 60, size: 18, font });
        let y = height - 100;
        for (let i = 0; i < 200; i++) {
          page.drawText(`Ligne ${i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. `.repeat(3), { x: 40, y, size: 10, font });
          y -= 12;
          if (y <= 40) break;
        }
      }
      const bytes = await pdfDoc.save();
      return new NextResponse(Buffer.from(bytes) as any, { headers: { 'Content-Type': 'application/pdf' } });
    } catch {}
  }
  // Redirection relative pour éviter les hôtes internes du conteneur dans Location
  const paramsArr = [
    `bilanId=${encodeURIComponent(id)}`,
    variant ? `variant=${encodeURIComponent(variant)}` : '',
    niveau ? `niveau=${encodeURIComponent(niveau)}` : '',
    dev ? `dev=${encodeURIComponent(dev)}` : '',
  ].filter(Boolean);
  const loc = `/api/bilan/pdf${paramsArr.length ? `?${paramsArr.join('&')}` : ''}`;
  return new Response(null, { status: 302, headers: { location: loc } });
}
