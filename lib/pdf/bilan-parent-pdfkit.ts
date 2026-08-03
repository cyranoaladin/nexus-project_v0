/**
 * Compatibility bridge for the legacy parent-bilan API.
 *
 * The historical PDFKit renderer was removed by A90.2.3. This module keeps its
 * public function name but delegates to the single Nexus HTML-to-PDF engine.
 */

import { BILAN_PRINT_BRAND, bilanPrintTokenCss } from '@/lib/bilans/render/brand';
import { renderHtmlToPdf } from '@/lib/bilans/render/pdf';
import type { BilanParentPDFData } from './bilan-parent-template';

export type BilanParentPdfDependencies = Readonly<{
  renderHtmlToPdf?: (html: string) => Promise<Buffer>;
}>;

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function inlineMarkdown(value: string): string {
  return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function legacyMarkdownToHtml(markdown: string): string {
  const cleaned = markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\$\$([\s\S]*?)\$\$/g, '$1')
    .replace(/\$([^$\n]+)\$/g, '$1')
    .replace(/^[─═]{4,}$/gm, '---')
    .replace(/%{5,}/g, '');
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | undefined;

  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push(`<p>${inlineMarkdown(paragraph.join(' ').trim())}</p>`);
      paragraph = [];
    }
    if (list !== undefined) {
      const tag = list.ordered ? 'ol' : 'ul';
      blocks.push(`<${tag}>${list.items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</${tag}>`);
      list = undefined;
    }
  };

  for (const rawLine of cleaned.split('\n')) {
    const line = rawLine.trim();
    if (line === '') { flush(); continue; }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    const unordered = line.match(/^[-*•]\s+(.+)$/);
    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (heading !== null) {
      flush();
      const level = Math.min(3, Math.max(2, heading[1].length));
      blocks.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
    } else if (unordered !== null || ordered !== null) {
      if (paragraph.length > 0) flush();
      const isOrdered = ordered !== null;
      if (list === undefined || list.ordered !== isOrdered) { flush(); list = { ordered: isOrdered, items: [] }; }
      list!.items.push((ordered ?? unordered)![1]);
    } else if (line === '---' || line === '***') {
      flush(); blocks.push('<hr>');
    } else {
      if (list !== undefined) flush();
      paragraph.push(line);
    }
  }
  flush();
  return blocks.join('');
}

export function renderLegacyParentBilanHtml(data: BilanParentPDFData): string {
  const published = new Date(data.publishedAt).toLocaleDateString('fr-FR', {
    timeZone: 'UTC', day: '2-digit', month: 'long', year: 'numeric',
  });
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(data.stageTitle)}</title><style>
  @font-face{font-family:'${BILAN_PRINT_BRAND.fonts.display}';src:url('${BILAN_PRINT_BRAND.fonts.displayAsset}') format('woff2')}@font-face{font-family:'${BILAN_PRINT_BRAND.fonts.body}';src:url('${BILAN_PRINT_BRAND.fonts.bodyAsset}') format('woff2')}
  :root{${bilanPrintTokenCss()}}*{box-sizing:border-box}body{margin:0;background:var(--color-lux-ivory);color:var(--color-lux-ink);font-family:var(--font-dm-sans);font-size:10.5pt;line-height:1.55}.page{width:210mm;min-height:297mm;margin:auto;padding:16mm;background:var(--color-lux-paper)}header{display:flex;gap:8mm;align-items:center;border-bottom:2px solid var(--color-lux-gold);padding-bottom:6mm;margin-bottom:8mm}header img{width:48mm;height:auto}h1,h2,h3{font-family:var(--font-fraunces)}h1{font-size:21pt;margin:0}h2{font-size:15pt;border-bottom:1px solid var(--color-lux-gold);padding-bottom:2mm;break-after:avoid}h3{font-size:12pt;break-after:avoid}.meta{padding:4mm;border:1px solid var(--color-lux-line);background:var(--color-lux-white);border-radius:3mm;margin-bottom:8mm}.content p,.content li{orphans:3;widows:3}.content h2,.content h3,.content ul,.content ol{break-inside:avoid}.content hr{border:0;border-top:1px solid var(--color-lux-line);margin:6mm 0}footer{display:flex;gap:3mm;align-items:center;margin-top:10mm;padding-top:4mm;border-top:1px solid var(--color-lux-line);color:var(--color-lux-slate)}footer img{width:9mm;height:9mm}@page{size: A4;margin:0}@media print{body{background:var(--color-lux-white)}.page{margin:0}}
  </style></head><body><article class="page" data-audience="PARENTS"><header><img src="${BILAN_PRINT_BRAND.logos.header}" alt="Nexus Réussite"><div><p>Bilan pédagogique</p><h1>${escapeHtml(data.stageTitle)}</h1><p>${escapeHtml(data.subjectLabel)}</p></div></header><section class="meta"><p><strong>Élève :</strong> ${escapeHtml(data.studentName)}</p><p><strong>Coach :</strong> ${escapeHtml(data.coachName ?? '—')}</p><p><strong>Publié le :</strong> ${escapeHtml(published)}</p></section><main class="content">${legacyMarkdownToHtml(data.parentsMarkdown)}</main><footer><img src="${BILAN_PRINT_BRAND.logos.compact}" alt=""><span>Nexus Réussite · Document confidentiel destiné à la famille</span></footer></article></body></html>`;
}

export async function renderBilanParentPDF(
  data: BilanParentPDFData,
  dependencies: BilanParentPdfDependencies = {},
): Promise<Buffer> {
  return (dependencies.renderHtmlToPdf ?? renderHtmlToPdf)(renderLegacyParentBilanHtml(data));
}
