/**
 * Premium PDF template for parent-facing stage bilans.
 * Uses PDFKit — server-side only, no React SSR issues.
 * Features: Nexus logo, colored section headers, inline bold, multi-page footer.
 */

import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import type { BilanParentPDFData } from './bilan-parent-template';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  brand:     '#4F46E5',
  brandSoft: '#EEF2FF',
  brandMid:  '#C7D2FE',
  accent:    '#0EA5E9',
  gold:      '#F59E0B',
  text:      '#0F172A',
  muted:     '#64748B',
  border:    '#E2E8F0',
  white:     '#FFFFFF',
} as const;

const PW        = 595.28;   // A4 width  (pt)
const PH        = 841.89;   // A4 height (pt)
const MX        = 48;       // left/right margin
const CW        = PW - MX * 2;
const FOOTER_H  = 44;
const HEADER_H  = 76;       // height of the brand band

// ─── Markdown AST ─────────────────────────────────────────────────────────────
type Block =
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'h4'; text: string }
  | { type: 'p';  text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'hr' };

function parseMarkdown(raw: string): Block[] {
  const cleaned = raw
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\$\$([\s\S]*?)\$\$/g, '$1')
    .replace(/\$([^$\n]+)\$/g, '$1')
    .replace(/^[─═]{4,}$/gm, '---')       // normalize box-drawing separators
    .replace(/%{5,}/g, '')                 // strip %%%%% from coach free text
    .replace(/^[#]{1}\s+/gm, '## ');      // promote h1 → h2

  const lines   = cleaned.split('\n');
  const blocks: Block[] = [];
  let listBuf: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let paraBuf: string[] = [];

  const flush = () => {
    if (paraBuf.length) {
      const t = paraBuf.join(' ').trim();
      if (t) blocks.push({ type: 'p', text: t });
      paraBuf = [];
    }
    if (listBuf) {
      blocks.push({ type: listBuf.type, items: [...listBuf.items] });
      listBuf = null;
    }
  };

  for (const rawLine of lines) {
    const line    = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) { flush(); continue; }

    const h2 = line.match(/^##\s+(.+)$/);
    const h3 = line.match(/^###\s+(.+)$/);
    const h4 = line.match(/^####\s+(.+)$/);
    const ul = line.match(/^\s*[-*•]\s+(.+)$/);
    const ol = line.match(/^\s*\d+\.\s+(.+)$/);
    const hr = trimmed === '---' || trimmed === '***' || trimmed === '___';

    if (h4) { flush(); blocks.push({ type: 'h4', text: h4[1] }); }
    else if (h3) { flush(); blocks.push({ type: 'h3', text: h3[1] }); }
    else if (h2) { flush(); blocks.push({ type: 'h2', text: h2[1] }); }
    else if (hr) { flush(); blocks.push({ type: 'hr' }); }
    else if (ul) {
      if (paraBuf.length) paraBuf = [];
      if (!listBuf || listBuf.type !== 'ul') { if (listBuf) { blocks.push({ type: listBuf.type, items: [...listBuf.items] }); } listBuf = { type: 'ul', items: [] }; }
      listBuf.items.push(ul[1]);
    } else if (ol) {
      if (paraBuf.length) paraBuf = [];
      if (!listBuf || listBuf.type !== 'ol') { if (listBuf) { blocks.push({ type: listBuf.type, items: [...listBuf.items] }); } listBuf = { type: 'ol', items: [] }; }
      listBuf.items.push(ol[1]);
    } else {
      if (listBuf) { blocks.push({ type: listBuf.type, items: [...listBuf.items] }); listBuf = null; }
      paraBuf.push(line);
    }
  }
  flush();
  return blocks;
}

// Strip **bold** for PDFKit calls that don't handle inline bold themselves
function plain(t: string): string {
  return t.replace(/\*\*(.+?)\*\*/g, '$1');
}

// ─── Inline bold renderer ─────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function textWithBold(doc: any, raw: string, x: number, y: number, opts: Record<string, unknown> = {}): void {
  const parts = raw.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  if (parts.length === 0) { doc.font('Helvetica').text('', x, y, opts); return; }

  for (let i = 0; i < parts.length; i++) {
    const part   = parts[i];
    const isBold = part.startsWith('**') && part.endsWith('**');
    const content = isBold ? part.slice(2, -2) : part;
    const isLast  = i === parts.length - 1;

    doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica');

    if (i === 0) {
      doc.text(content, x, y, { ...opts, continued: !isLast });
    } else {
      doc.text(content, { ...opts, continued: !isLast });
    }
  }
}

// ─── Page helpers ─────────────────────────────────────────────────────────────
function estimateHeight(block: Block): number {
  switch (block.type) {
    case 'h2': return 40;
    case 'h3': return 30;
    case 'h4': return 24;
    case 'p':  return Math.max(20, Math.ceil(plain(block.text).length / 85) * 16) + 12;
    case 'ul':
    case 'ol': return block.items.length * 20 + 10;
    case 'hr': return 18;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ensureSpace(doc: any, needed: number): void {
  if (doc.y + needed > PH - FOOTER_H - 16) {
    doc.addPage();
    doc.y = MX;
  }
}

// ─── Block renderers ──────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderH2(doc: any, text: string): void {
  ensureSpace(doc, 50);
  const y = doc.y + 10;
  const H = 30;
  doc.rect(MX, y, CW, H).fill(C.brand);
  doc.rect(MX, y, 5, H).fill(C.gold);
  doc.fillColor(C.white).fontSize(11.5).font('Helvetica-Bold')
     .text(plain(text), MX + 16, y + 9, { width: CW - 24, lineBreak: false });
  doc.y = y + H + 8;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderH3(doc: any, text: string): void {
  ensureSpace(doc, 36);
  const y = doc.y + 8;
  doc.rect(MX, y + 1, 3, 16).fill(C.accent);
  doc.fillColor(C.brand).fontSize(11).font('Helvetica-Bold')
     .text(plain(text), MX + 10, y, { width: CW - 10 });
  doc.y = doc.y + 6;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderH4(doc: any, text: string): void {
  ensureSpace(doc, 26);
  doc.y += 4;
  doc.fillColor(C.accent).fontSize(10.5).font('Helvetica-Bold')
     .text(plain(text), MX, doc.y, { width: CW });
  doc.y += 4;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderParagraph(doc: any, text: string): void {
  ensureSpace(doc, 20);
  doc.fillColor(C.text).fontSize(10.5);
  textWithBold(doc, text, MX, doc.y, { width: CW, lineGap: 2.5, align: 'justify' });
  doc.y += 8;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderList(doc: any, items: string[], ordered: boolean): void {
  const bulletW = ordered ? 22 : 16;
  for (let i = 0; i < items.length; i++) {
    ensureSpace(doc, 20);
    const itemY  = doc.y;
    const bullet = ordered ? `${i + 1}.` : '•';
    doc.fillColor(C.brand).fontSize(10.5).font('Helvetica-Bold')
       .text(bullet, MX + 4, itemY, { width: bulletW, lineBreak: false });
    doc.fillColor(C.text).fontSize(10.5);
    textWithBold(doc, items[i], MX + 4 + bulletW, itemY, { width: CW - 4 - bulletW, lineGap: 2 });
    doc.y += 3;
  }
  doc.y += 5;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderHR(doc: any): void {
  ensureSpace(doc, 20);
  doc.y += 8;
  doc.moveTo(MX, doc.y).lineTo(PW - MX, doc.y).lineWidth(0.4).strokeColor(C.border).stroke();
  doc.y += 12;
}

// ─── Header & meta ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawPageHeader(doc: any, data: BilanParentPDFData): void {
  // Brand band
  doc.rect(0, 0, PW, HEADER_H).fill(C.brand);
  // Gold accent stripe
  doc.rect(0, HEADER_H, PW, 3).fill(C.gold);

  // Logo
  try {
    const logoPath = path.join(process.cwd(), 'public', 'images', 'logo_slogan_nexus.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, MX, 13, { height: 50, fit: [165, 50] });
    } else {
      doc.fillColor(C.white).fontSize(15).font('Helvetica-Bold').text('NEXUS RÉUSSITE', MX, 28, { lineBreak: false });
    }
  } catch {
    doc.fillColor(C.white).fontSize(15).font('Helvetica-Bold').text('NEXUS RÉUSSITE', MX, 28, { lineBreak: false });
  }

  // Website (right-aligned in band)
  doc.fillColor('#A5B4FC').fontSize(7.5).font('Helvetica')
     .text('nexusreussite.academy', 0, 60, { width: PW - MX, align: 'right', lineBreak: false });

  // Title & subtitle below band
  const titleY = HEADER_H + 3 + 16;
  doc.fillColor(C.text).fontSize(21).font('Helvetica-Bold')
     .text(`Bilan de stage — ${data.subjectLabel}`, MX, titleY, { width: CW });
  doc.fillColor(C.muted).fontSize(11).font('Helvetica')
     .text(data.stageTitle, MX, doc.y + 4, { width: CW });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawMetaBox(doc: any, data: BilanParentPDFData): number {
  const hasScore = data.globalScore !== null;
  const boxTop   = doc.y + 20;
  const boxH     = hasScore ? 84 : 68;
  const half     = MX + CW / 2 + 8;

  doc.roundedRect(MX, boxTop, CW, boxH, 8).fillAndStroke(C.brandSoft, C.brandMid);

  const lbl = (txt: string, x: number, y: number) =>
    doc.fillColor(C.muted).fontSize(7.5).font('Helvetica')
       .text(txt, x, y, { lineBreak: false, characterSpacing: 0.4 });
  const val = (txt: string, x: number, y: number, size = 11) =>
    doc.fillColor(C.text).fontSize(size).font('Helvetica-Bold')
       .text(txt, x, y, { lineBreak: false });

  lbl('ÉLÈVE',   MX + 14, boxTop + 12); val(data.studentName,        MX + 14, boxTop + 23);
  lbl('COACH',   half,     boxTop + 12); val(data.coachName ?? '—',  half,     boxTop + 23);

  const dateLabel = new Date(data.publishedAt).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  lbl('PUBLIÉ LE', MX + 14, boxTop + (hasScore ? 48 : 44));
  doc.fillColor(C.text).fontSize(10).font('Helvetica')
     .text(dateLabel, MX + 14, boxTop + (hasScore ? 59 : 55), { lineBreak: false });

  if (hasScore) {
    lbl('SCORE GLOBAL', half, boxTop + 48);
    doc.fillColor(C.brand).fontSize(20).font('Helvetica-Bold')
       .text(`${Math.round(data.globalScore!)}/100`, half, boxTop + 56, { lineBreak: false });
  }

  return boxTop + boxH;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawFooter(doc: any, studentName: string, page: number, total: number): void {
  const y = PH - FOOTER_H;
  doc.rect(0, y, PW, 2).fill(C.brand);
  doc.rect(0, y + 2, PW, FOOTER_H - 2).fill(C.brandSoft);

  doc.fillColor(C.muted).fontSize(7.5).font('Helvetica')
     .text(
       `Bilan généré par Nexus Réussite — Document confidentiel destiné à la famille de ${studentName}`,
       MX, y + 12, { width: CW - 50 }
     );
  doc.fillColor(C.muted).fontSize(7.5).font('Helvetica')
     .text('© Nexus Réussite', MX, y + 24, { width: CW - 50 });
  doc.fillColor(C.brand).fontSize(8.5).font('Helvetica-Bold')
     .text(`${page} / ${total}`, 0, y + 16, { width: PW - MX, align: 'right' });
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function renderBilanParentPDF(data: BilanParentPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,          // margin:0 → auto-wrap at PH (841pt), not PH-margin
      bufferPages: true,
      info: {
        Title:   `Bilan de stage — ${data.subjectLabel} — ${data.studentName}`,
        Author:  'Nexus Réussite',
        Subject: 'Bilan pédagogique de stage',
        Keywords: 'bilan,stage,nexus,réussite',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data',  (c: Buffer) => chunks.push(c));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Page 1 layout ────────────────────────────────────────────────────────
    drawPageHeader(doc, data);
    const metaBottom = drawMetaBox(doc, data);

    // Separator
    const contentStart = metaBottom + 22;
    doc.moveTo(MX, contentStart - 10).lineTo(PW - MX, contentStart - 10)
       .lineWidth(0.4).strokeColor(C.border).stroke();

    doc.y = contentStart;

    // ── Content ───────────────────────────────────────────────────────────────
    const blocks = parseMarkdown(data.parentsMarkdown);
    for (const block of blocks) {
      switch (block.type) {
        case 'h2': renderH2(doc, block.text); break;
        case 'h3': renderH3(doc, block.text); break;
        case 'h4': renderH4(doc, block.text); break;
        case 'p':  renderParagraph(doc, block.text); break;
        case 'ul': renderList(doc, block.items, false); break;
        case 'ol': renderList(doc, block.items, true);  break;
        case 'hr': renderHR(doc); break;
      }
    }

    // ── Footers on all pages ──────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      drawFooter(doc, data.studentName, i + 1, range.count);
    }

    doc.end();
  });
}
