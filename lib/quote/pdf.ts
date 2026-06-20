import { existsSync } from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { LEGAL } from '@/lib/legal';

const COLORS = {
  navy: '#0B1F4D',
  navySoft: '#1E3A5F',
  gold: '#C9A24D',
  text: '#111827',
  secondary: '#64748B',
  muted: '#94A3B8',
  border: '#D9E2F2',
  surface: '#F8FAFC',
  white: '#FFFFFF',
} as const;

const FONTS = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  oblique: 'Helvetica-Oblique',
} as const;

const PAGE = {
  width: 595.28,
  height: 841.89,
  marginLeft: 44,
  marginRight: 44,
  marginTop: 34,
  marginBottom: 42,
} as const;

const CONTENT_WIDTH = PAGE.width - PAGE.marginLeft - PAGE.marginRight;
const LOGO_SLOGAN_PATH = path.join(process.cwd(), 'public', 'images', 'logo_slogan_nexus.png');
const BRAND_SLOGAN = 'Votre Avenir, Notre Passion';

export interface QuoteInstallmentData {
  label: string;
  amount: number;
}

export interface QuoteOfferData {
  label: string;
  desc: string;
  annualDisplay: string;
  inc: string[];
  ech: QuoteInstallmentData[];
}

export interface QuoteAlternativeData {
  label: string;
  desc: string;
  annualDisplay: string;
}

export interface QuotePDFData {
  quoteNumber: string;
  generatedAt: string;
  validUntil: string;
  studentName: string;
  parentName: string;
  whatsapp: string;
  email: string;
  advisor: string;
  level: string;
  status: string;
  establishment: string;
  languages: string;
  currentLevel: string;
  specialites: string[];
  options: string[];
  modalite: string;
  objectif: string;
  budget: string;
  mode: string;
  reduction: string;
  reductionLabels: string[];
  hasDirectionOverride: boolean;
  publicAnnual?: number | null;
  monthlyDisplay?: string | null;
  economie?: number | null;
  internalNotes?: string;
  offer: QuoteOfferData;
  alternatives: QuoteAlternativeData[];
}

/**
 * Sanitize text for Helvetica rendering in PDFKit.
 * - Replace narrow no-break space (U+202F) and no-break space (U+00A0) with regular space
 * - Replace ≈ (U+2248) with ~ (Helvetica lacks ≈)
 * - Replace — (em dash) with - if needed (Helvetica has it, but be safe)
 * - Strip other non-Latin-1 characters that Helvetica cannot render
 */
function sanitize(str: string): string {
  return str
    .replace(/[\u202F\u00A0]/g, ' ')   // non-breaking spaces → regular space
    .replace(/\u2248/g, '~')            // ≈ → ~
    .replace(/'/g, "'")            // right single quote → apostrophe
    .replace(/[\u201C\u201D]/g, '"')    // smart double quotes → straight
    .replace(/\u2026/g, '...');         // … → ...
}

function text(value: unknown, fallback = 'A preciser'): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = sanitize(value.trim());
  return trimmed || fallback;
}

function clamp(value: string, max = 120): string {
  const s = sanitize(value);
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}...` : s;
}

function fmtMoney(value: number): string {
  if (!Number.isFinite(value)) return 'A valider';
  return `${String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} TND`;
}

function joinList(items: unknown, fallback = 'Non renseigné'): string {
  return Array.isArray(items) && items.length
    ? items.map(item => text(item, '')).filter(Boolean).join(', ')
    : fallback;
}

function normalizeQuoteData(data: QuotePDFData): QuotePDFData {
  return {
    ...data,
    quoteNumber: text(data.quoteNumber, 'NX-DEVIS'),
    generatedAt: text(data.generatedAt),
    validUntil: text(data.validUntil),
    studentName: text(data.studentName),
    parentName: text(data.parentName),
    whatsapp: text(data.whatsapp),
    email: text(data.email),
    advisor: text(data.advisor, 'Nexus Réussite'),
    level: text(data.level),
    status: text(data.status),
    establishment: text(data.establishment, 'Non renseigné'),
    languages: text(data.languages, 'Non renseigné'),
    currentLevel: text(data.currentLevel, 'Non renseigné'),
    specialites: Array.isArray(data.specialites) ? data.specialites.map(item => text(item, '')).filter(Boolean) : [],
    options: Array.isArray(data.options) ? data.options.map(item => text(item, '')).filter(Boolean) : [],
    modalite: text(data.modalite, 'Non applicable'),
    objectif: text(data.objectif),
    budget: text(data.budget),
    mode: text(data.mode),
    reduction: text(data.reduction, '0%'),
    reductionLabels: Array.isArray(data.reductionLabels) ? data.reductionLabels.map(item => text(item, '')).filter(Boolean) : [],
    hasDirectionOverride: Boolean(data.hasDirectionOverride),
    offer: {
      label: text(data.offer?.label, 'Offre à valider'),
      desc: text(data.offer?.desc, 'Format à préciser lors de la validation pédagogique.'),
      annualDisplay: text(data.offer?.annualDisplay, 'Tarif à valider'),
      inc: Array.isArray(data.offer?.inc) ? data.offer.inc.map(item => text(item, '')).filter(Boolean) : [],
      ech: Array.isArray(data.offer?.ech)
        ? data.offer.ech
          .filter(item => item && typeof item === 'object')
          .map(item => ({
            label: text((item as QuoteInstallmentData).label, 'Tranche'),
            amount: Number((item as QuoteInstallmentData).amount),
          }))
        : [],
    },
    alternatives: Array.isArray(data.alternatives)
      ? data.alternatives.map(item => ({
        label: text(item?.label, 'Alternative'),
        desc: text(item?.desc, ''),
        annualDisplay: text(item?.annualDisplay, 'Tarif à valider'),
      }))
      : [],
  };
}

function drawFooter(doc: PDFKit.PDFDocument, pageNumber: number) {
  const y = PAGE.height - PAGE.marginBottom - 22;
  doc.moveTo(PAGE.marginLeft, y - 12).lineTo(PAGE.width - PAGE.marginRight, y - 12)
    .strokeColor(COLORS.border).lineWidth(0.6).stroke();
  doc.font(FONTS.bold).fontSize(7).fillColor(COLORS.navy)
    .text(`Nexus Réussite — ${BRAND_SLOGAN}`, PAGE.marginLeft, y, {
      width: CONTENT_WIDTH,
      align: 'center',
    });
  doc.font(FONTS.regular).fontSize(6.5).fillColor(COLORS.muted)
    .text(`${LEGAL.web.domain} · ${LEGAL.contact.phone} · ${LEGAL.contact.email} · Page ${pageNumber}`, PAGE.marginLeft, y + 10, {
      width: CONTENT_WIDTH,
      align: 'center',
    });
}

function drawTopBar(doc: PDFKit.PDFDocument) {
  doc.rect(0, 0, PAGE.width, 7).fill(COLORS.navy);
  doc.rect(PAGE.width - 150, 0, 150, 7).fill(COLORS.gold);
}

function label(doc: PDFKit.PDFDocument, value: string, x: number, y: number, width: number) {
  doc.font(FONTS.bold).fontSize(6.7).fillColor(COLORS.gold)
    .text(value.toUpperCase(), x, y, { width, characterSpacing: 0.5 });
}

function roundedBox(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, fill: string = COLORS.surface) {
  doc.roundedRect(x, y, w, h, 5).fillAndStroke(fill, COLORS.border);
}

function drawHeader(doc: PDFKit.PDFDocument, data: QuotePDFData) {
  drawTopBar(doc);
  const y = 28;

  let issuerY = y;
  if (existsSync(LOGO_SLOGAN_PATH)) {
    try {
      doc.image(LOGO_SLOGAN_PATH, PAGE.marginLeft, y - 8, { width: 150 });
      issuerY = y + 58;
    } catch {
      issuerY = y;
    }
  }

  doc.font(FONTS.bold).fontSize(13).fillColor(COLORS.navy)
    .text(LEGAL.entity.name, PAGE.marginLeft, issuerY, { width: 270 });
  doc.font(FONTS.regular).fontSize(7.8).fillColor(COLORS.secondary)
    .text('Établissement d’accompagnement pédagogique', PAGE.marginLeft, issuerY + 16)
    .text(LEGAL.addresses.siege.full, PAGE.marginLeft, issuerY + 29)
    .text(`MF : ${LEGAL.entity.taxId} · ${LEGAL.contact.phone}`, PAGE.marginLeft, issuerY + 42);

  const rightX = PAGE.width - PAGE.marginRight - 210;
  doc.font(FONTS.bold).fontSize(22).fillColor(COLORS.navy)
    .text('PROPOSITION', rightX, y + 3, { width: 210, align: 'right' });
  doc.font(FONTS.bold).fontSize(9.5).fillColor(COLORS.text)
    .text('Devis personnalisé', rightX, y + 31, { width: 210, align: 'right' });
  doc.font(FONTS.regular).fontSize(7.2).fillColor(COLORS.secondary)
    .text('Proposition d’accompagnement 2026/2027', rightX, y + 45, { width: 210, align: 'right' });

  const metaY = y + 66;
  const meta = [
    ['Référence', data.quoteNumber],
    ['Date', data.generatedAt],
    ['Validité', data.validUntil],
  ];
  meta.forEach(([k, v], index) => {
    const rowY = metaY + index * 13;
    doc.font(FONTS.bold).fontSize(6.5).fillColor(COLORS.muted)
      .text(k.toUpperCase(), rightX, rowY, { width: 82, align: 'right' });
    doc.font(FONTS.bold).fontSize(7.2).fillColor(COLORS.text)
      .text(v, rightX + 88, rowY, { width: 122, align: 'right' });
  });

  doc.moveTo(PAGE.marginLeft, 128).lineTo(PAGE.width - PAGE.marginRight, 128)
    .strokeColor(COLORS.border).lineWidth(0.7).stroke();
}

function drawPartyBoxes(doc: PDFKit.PDFDocument, data: QuotePDFData, y: number): number {
  const gap = 14;
  const w = (CONTENT_WIDTH - gap) / 2;
  const boxH = 72;
  roundedBox(doc, PAGE.marginLeft, y, w, boxH);
  roundedBox(doc, PAGE.marginLeft + w + gap, y, w, boxH);

  label(doc, 'Proposition pour', PAGE.marginLeft + 12, y + 13, w - 24);
  doc.font(FONTS.bold).fontSize(10).fillColor(COLORS.text)
    .text(data.parentName, PAGE.marginLeft + 12, y + 31, { width: w - 24 });
  doc.font(FONTS.regular).fontSize(7.6).fillColor(COLORS.secondary)
    .text(data.email, PAGE.marginLeft + 12, y + 47, { width: w - 24 })
    .text(data.whatsapp, PAGE.marginLeft + 12, y + 59, { width: w - 24 });

  const x2 = PAGE.marginLeft + w + gap;
  label(doc, 'Élève et profil', x2 + 12, y + 13, w - 24);
  doc.font(FONTS.bold).fontSize(10).fillColor(COLORS.text)
    .text(data.studentName, x2 + 12, y + 31, { width: w - 24 });
  doc.font(FONTS.regular).fontSize(7.6).fillColor(COLORS.secondary)
    .text(clamp(`${data.level} · ${data.status}`, 74), x2 + 12, y + 47, { width: w - 24 })
    .text(clamp(data.establishment, 74), x2 + 12, y + 59, { width: w - 24 });

  return y + boxH;
}

function drawRecommendation(doc: PDFKit.PDFDocument, data: QuotePDFData, y: number): number {
  const pubAnnual = data.publicAnnual ?? undefined;
  const eco = data.economie ?? undefined;
  const monthlyRef = data.monthlyDisplay ? sanitize(data.monthlyDisplay) : undefined;
  const hasSavings = pubAnnual && eco && eco > 0;

  const recoBoxH = hasSavings ? 96 : 88;
  roundedBox(doc, PAGE.marginLeft, y, CONTENT_WIDTH, recoBoxH, COLORS.white);
  label(doc, 'Synthese de la recommandation', PAGE.marginLeft + 14, y + 15, 280);
  doc.font(FONTS.bold).fontSize(18).fillColor(COLORS.navy)
    .text(data.offer.label, PAGE.marginLeft + 14, y + 31, { width: 310 });
  doc.font(FONTS.regular).fontSize(8.5).fillColor(COLORS.secondary)
    .text(clamp(data.offer.desc, 155), PAGE.marginLeft + 14, y + 57, { width: 310, lineGap: 2 });

  const totalX = PAGE.width - PAGE.marginRight - 170;
  const navyH = hasSavings ? 72 : 60;
  doc.roundedRect(totalX, y + 14, 156, navyH, 5).fill(COLORS.navy);
  label(doc, 'Total indicatif', totalX + 12, y + 22, 132);
  doc.font(FONTS.bold).fontSize(14).fillColor(COLORS.white)
    .text(sanitize(data.offer.annualDisplay), totalX + 12, y + 34, { width: 132 });
  if (hasSavings) {
    doc.font(FONTS.regular).fontSize(6.2).fillColor('#B0C4DE')
      .text(`Public ${fmtMoney(pubAnnual!)} | Economie ${fmtMoney(eco!)}`, totalX + 12, y + 52, { width: 132 });
    if (monthlyRef) {
      doc.font(FONTS.oblique).fontSize(6.2).fillColor('#DDE7F6')
        .text(monthlyRef, totalX + 12, y + 63, { width: 132 });
    }
    const reduction = data.reductionLabels.length
      ? `${data.reduction} - ${data.reductionLabels.join(', ')}${data.hasDirectionOverride ? ' - validation direction' : ''}`
      : '';
    if (reduction) {
      doc.font(FONTS.regular).fontSize(6).fillColor('#DDE7F6')
        .text(clamp(reduction, 92), totalX + 12, y + 74, { width: 132 });
    }
  } else {
    const fallbackText = monthlyRef || (data.reductionLabels.length
      ? `${data.reduction} - ${data.reductionLabels.join(', ')}${data.hasDirectionOverride ? ' - validation direction' : ''}`
      : 'Aucune reduction appliquee');
    doc.font(FONTS.regular).fontSize(6.5).fillColor('#DDE7F6')
      .text(clamp(fallbackText, 92), totalX + 12, y + 52, { width: 132 });
  }

  return y + recoBoxH;
}

function drawSummaryTable(doc: PDFKit.PDFDocument, data: QuotePDFData, y: number): number {
  doc.font(FONTS.bold).fontSize(11).fillColor(COLORS.navy)
    .text('Tableau de synthèse', PAGE.marginLeft, y);
  y += 20;
  const cols = [0, 270, 390, CONTENT_WIDTH];
  doc.rect(PAGE.marginLeft, y, CONTENT_WIDTH, 24).fill(COLORS.navy);
  ['DÉSIGNATION', 'FORMAT', 'REPÈRE'].forEach((title, index) => {
    doc.font(FONTS.bold).fontSize(6.8).fillColor(COLORS.white)
      .text(title, PAGE.marginLeft + cols[index] + 8, y + 9, { width: cols[index + 1] - cols[index] - 16 });
  });
  y += 24;
  const rowH = 52;
  doc.rect(PAGE.marginLeft, y, CONTENT_WIDTH, rowH).fillAndStroke(COLORS.white, COLORS.border);
  doc.font(FONTS.bold).fontSize(8.8).fillColor(COLORS.text)
    .text(data.offer.label, PAGE.marginLeft + 8, y + 10, { width: 248 });
  doc.font(FONTS.regular).fontSize(7.4).fillColor(COLORS.secondary)
    .text(clamp(data.offer.desc, 160), PAGE.marginLeft + 8, y + 24, { width: 248 });
  doc.font(FONTS.regular).fontSize(8).fillColor(COLORS.text)
    .text(data.mode, PAGE.marginLeft + 278, y + 10, { width: 100 });
  doc.font(FONTS.regular).fontSize(7.2).fillColor(COLORS.secondary)
    .text(clamp(data.objectif, 100), PAGE.marginLeft + 278, y + 24, { width: 100 });
  doc.font(FONTS.bold).fontSize(9).fillColor(COLORS.navy)
    .text(data.offer.annualDisplay, PAGE.marginLeft + 398, y + 18, { width: CONTENT_WIDTH - 406, align: 'right' });

  return y + rowH;
}

function drawInstallmentsAndInclusions(doc: PDFKit.PDFDocument, data: QuotePDFData, y: number) {
  const gap = 14;
  const w = (CONTENT_WIDTH - gap) / 2;
  const echCount = Math.min(data.offer.ech.length, 9);
  const incCount = Math.min(data.offer.inc.length, 9);
  const echH = 38 + echCount * 20 + (echCount > 1 ? 24 : 0);
  const incH = 39 + incCount * 18;
  const h = Math.max(echH, incH, 142);
  roundedBox(doc, PAGE.marginLeft, y, w, h, COLORS.white);
  roundedBox(doc, PAGE.marginLeft + w + gap, y, w, h, COLORS.white);

  doc.font(FONTS.bold).fontSize(11).fillColor(COLORS.navy)
    .text('Échéancier indicatif', PAGE.marginLeft + 12, y + 14);
  let rowY = y + 38;
  const installments = data.offer.ech.length ? data.offer.ech : [{ label: 'Échéancier', amount: NaN }];
  installments.forEach((item, index) => {
    if (index % 2 === 1) doc.rect(PAGE.marginLeft + 12, rowY - 5, w - 24, 20).fill(COLORS.surface);
    doc.font(FONTS.regular).fontSize(8).fillColor(COLORS.text)
      .text(item.label, PAGE.marginLeft + 18, rowY, { width: 118 });
    doc.font(FONTS.bold).fontSize(8).fillColor(COLORS.navy)
      .text(fmtMoney(item.amount), PAGE.marginLeft + 120, rowY, { width: w - 142, align: 'right' });
    rowY += 20;
  });
  if (installments.length === 1) {
    doc.font(FONTS.regular).fontSize(7).fillColor(COLORS.secondary)
      .text('Échéancier personnalisé à établir lors de l\'inscription.', PAGE.marginLeft + 18, rowY + 4, { width: w - 36 });
  }
  if (installments.length > 1) {
    const total = installments.reduce((sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : 0), 0);
    doc.moveTo(PAGE.marginLeft + 12, rowY - 4).lineTo(PAGE.marginLeft + w - 12, rowY - 4)
      .strokeColor(COLORS.navy).lineWidth(0.8).stroke();
    doc.font(FONTS.bold).fontSize(8.5).fillColor(COLORS.navy)
      .text('TOTAL', PAGE.marginLeft + 18, rowY + 2, { width: 118 });
    doc.font(FONTS.bold).fontSize(9).fillColor(COLORS.navy)
      .text(fmtMoney(total), PAGE.marginLeft + 120, rowY + 2, { width: w - 142, align: 'right' });
  }

  const x2 = PAGE.marginLeft + w + gap;
  doc.font(FONTS.bold).fontSize(11).fillColor(COLORS.navy)
    .text('Inclus dans le parcours', x2 + 12, y + 14);
  let itemY = y + 39;
  const inclusions = data.offer.inc.length ? data.offer.inc : ['Détails confirmés pendant la validation pédagogique.'];
  inclusions.slice(0, 9).forEach(item => {
    doc.circle(x2 + 17, itemY + 3.5, 2.8).fill(COLORS.gold);
    doc.font(FONTS.regular).fontSize(7.7).fillColor(COLORS.text)
      .text(clamp(item, 80), x2 + 28, itemY, { width: w - 42, lineGap: 1 });
    itemY += 18;
  });
}

function measureGridHeight(doc: PDFKit.PDFDocument, rows: Array<[string, string]>, w: number): number {
  let total = 39;
  rows.forEach(([, value]) => {
    const cellText = clamp(value, 120);
    const textH = doc.font(FONTS.bold).fontSize(7.6).heightOfString(cellText, { width: w - 108 });
    total += Math.max(20, textH + 6);
  });
  return total + 12;
}

function drawDefinitionGrid(doc: PDFKit.PDFDocument, title: string, rows: Array<[string, string]>, x: number, y: number, w: number, h: number) {
  roundedBox(doc, x, y, w, h, COLORS.white);
  doc.font(FONTS.bold).fontSize(11).fillColor(COLORS.navy).text(title, x + 12, y + 14, { width: w - 24 });
  let rowY = y + 39;
  rows.forEach(([key, value]) => {
    doc.font(FONTS.bold).fontSize(6.7).fillColor(COLORS.secondary)
      .text(key.toUpperCase(), x + 12, rowY, { width: 82 });
    const cellText = clamp(value, 120);
    doc.font(FONTS.bold).fontSize(7.6).fillColor(COLORS.text)
      .text(cellText, x + 96, rowY, { width: w - 108 });
    const textH = doc.font(FONTS.bold).fontSize(7.6).heightOfString(cellText, { width: w - 108 });
    rowY += Math.max(20, textH + 6);
  });
}

function drawPageTwo(doc: PDFKit.PDFDocument, data: QuotePDFData) {
  doc.addPage();
  drawTopBar(doc);
  let y = 30;
  doc.font(FONTS.bold).fontSize(15).fillColor(COLORS.navy)
    .text('Détails pédagogiques et conditions', PAGE.marginLeft, y);
  doc.font(FONTS.regular).fontSize(8).fillColor(COLORS.secondary)
    .text(`Proposition ${data.quoteNumber} · Conseiller : ${data.advisor}`, PAGE.marginLeft, y + 19);

  y += 48;
  const gap = 14;
  const w = (CONTENT_WIDTH - gap) / 2;
  const profilRows: Array<[string, string]> = [
    ['Élève', data.studentName],
    ['Responsable', data.parentName],
    ['WhatsApp', data.whatsapp],
    ['E-mail', data.email],
    ['Niveau', data.level],
    ['Statut', data.status],
    ['Établissement', data.establishment],
    ['Langues', data.languages],
  ];

  const besoinRows: Array<[string, string]> = [
    ['Objectif', data.objectif],
    ['Budget', data.budget],
    ['Mode', data.mode],
    ['Niveau ressenti', data.currentLevel],
    ...(!/seconde|brevet|troisi/i.test(data.level) ? [['Spécialités', joinList(data.specialites)] as [string, string]] : []),
    ...(!/seconde|brevet|troisi/i.test(data.level) ? [['Options', joinList(data.options)] as [string, string]] : []),
  ];
  if (data.status.toLowerCase().includes('libre') || data.status.toLowerCase().includes('double')) {
    besoinRows.push(['Candidat libre', data.modalite]);
  }

  const profilH = measureGridHeight(doc, profilRows, w);
  const besoinH = measureGridHeight(doc, besoinRows, w);
  const gridH = Math.max(profilH, besoinH, 204);

  drawDefinitionGrid(doc, 'Profil élève et famille', profilRows, PAGE.marginLeft, y, w, gridH);
  drawDefinitionGrid(doc, 'Besoin pédagogique', besoinRows, PAGE.marginLeft + w + gap, y, w, gridH);

  y += gridH + 22;
  const altH = 88;
  roundedBox(doc, PAGE.marginLeft, y, w, altH, COLORS.white);
  doc.font(FONTS.bold).fontSize(11).fillColor(COLORS.navy)
    .text('Alternatives étudiées', PAGE.marginLeft + 12, y + 14);
  const alternatives = data.alternatives.length ? data.alternatives.slice(0, 2) : [{ label: 'Aucune alternative prioritaire', desc: 'La proposition principale reste le format recommandé.', annualDisplay: '' }];
  let altY = y + 36;
  alternatives.forEach(alt => {
    doc.font(FONTS.bold).fontSize(7.8).fillColor(COLORS.text).text(alt.label, PAGE.marginLeft + 12, altY, { width: w - 24 });
    doc.font(FONTS.regular).fontSize(6.8).fillColor(COLORS.secondary).text(clamp(`${alt.annualDisplay} · ${alt.desc}`, 140), PAGE.marginLeft + 12, altY + 11, { width: w - 24 });
    altY += 29;
  });

  const condX = PAGE.marginLeft + w + gap;
  roundedBox(doc, condX, y, w, altH, COLORS.surface);
  doc.font(FONTS.bold).fontSize(11).fillColor(COLORS.navy)
    .text('Conditions de validation', condX + 12, y + 14);
  doc.font(FONTS.regular).fontSize(7.5).fillColor(COLORS.text)
    .text('Validation pédagogique, disponibilité du groupe, pièces administratives et règlement de la réservation.', condX + 12, y + 36, { width: w - 24, lineGap: 2 })
    { const pubA = data.publicAnnual;
    const condLine2 = pubA
      ? 'Le tarif et l\'échéancier restent indicatifs jusqu\'à inscription définitive. Le tarif fidélité dépend des places disponibles, pas d\'une échéance fixe.'
      : 'Le tarif et l\'échéancier restent indicatifs jusqu\'à inscription définitive.';
    doc.font(FONTS.regular).fontSize(7.5).fillColor(COLORS.text)
      .text(condLine2, condX + 12, y + 63, { width: w - 24, lineGap: 1 });
  }

  y += 112;
  doc.font(FONTS.bold).fontSize(11).fillColor(COLORS.navy)
    .text('Prochaines étapes', PAGE.marginLeft, y);
  y += 24;
  const steps = [
    ['1', 'Validation pédagogique', 'Confirmer niveau, statut, spécialités et disponibilités.'],
    ['2', 'Validation administrative', 'Contrôler les pièces utiles et le calendrier officiel.'],
    ['3', 'Réservation', 'Bloquer la place sous réserve de disponibilité et paiement.'],
  ];
  const stepW = (CONTENT_WIDTH - 20) / 3;
  steps.forEach(([num, title, body], index) => {
    const x = PAGE.marginLeft + index * (stepW + 10);
    roundedBox(doc, x, y, stepW, 70, COLORS.white);
    doc.circle(x + 16, y + 20, 9).fill(COLORS.gold);
    doc.font(FONTS.bold).fontSize(8).fillColor(COLORS.white).text(num, x + 13, y + 15, { width: 7, align: 'center' });
    doc.font(FONTS.bold).fontSize(8).fillColor(COLORS.navy).text(title, x + 31, y + 13, { width: stepW - 42 });
    doc.font(FONTS.regular).fontSize(6.8).fillColor(COLORS.secondary).text(body, x + 12, y + 36, { width: stepW - 24, lineGap: 1 });
  });

  y += 95;
  roundedBox(doc, PAGE.marginLeft, y, CONTENT_WIDTH, 94, COLORS.surface);
  doc.font(FONTS.bold).fontSize(11).fillColor(COLORS.navy)
    .text('Cadre et réserves', PAGE.marginLeft + 12, y + 13);
  doc.font(FONTS.regular).fontSize(7.4).fillColor(COLORS.text)
    .text('Cette proposition non contractuelle est un repère d’accompagnement établi à partir des informations communiquées pendant l’entretien. L’inscription définitive dépend de la validation pédagogique, des places disponibles, des pièces administratives et du calendrier officiel.', PAGE.marginLeft + 12, y + 34, { width: CONTENT_WIDTH - 24, lineGap: 2 })
    .text('Nexus Réussite formalise un engagement de moyens : accompagnement structuré, suivi, entraînement et cadre de travail. Aucune progression, mention ou réussite à l’examen ne peut être garantie.', PAGE.marginLeft + 12, y + 66, { width: CONTENT_WIDTH - 24, lineGap: 2 });

  y += 114;
  const sigW = (CONTENT_WIDTH - 14) / 2;
  roundedBox(doc, PAGE.marginLeft, y, sigW, 48, COLORS.white);
  roundedBox(doc, PAGE.marginLeft + sigW + 14, y, sigW, 48, COLORS.white);
  doc.font(FONTS.bold).fontSize(8).fillColor(COLORS.navy).text('Nexus Réussite', PAGE.marginLeft + 12, y + 13);
  doc.font(FONTS.regular).fontSize(7).fillColor(COLORS.secondary).text('Direction pédagogique', PAGE.marginLeft + 12, y + 27);
  doc.font(FONTS.bold).fontSize(8).fillColor(COLORS.navy).text('Conseiller', PAGE.marginLeft + sigW + 26, y + 13);
  doc.font(FONTS.regular).fontSize(7).fillColor(COLORS.secondary).text(data.advisor, PAGE.marginLeft + sigW + 26, y + 27);

  drawFooter(doc, 2);
}

export async function renderQuotePDF(input: QuotePDFData): Promise<Buffer> {
  const data = normalizeQuoteData(input);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        compress: true,
        margins: {
          top: PAGE.marginTop,
          bottom: PAGE.marginBottom,
          left: PAGE.marginLeft,
          right: PAGE.marginRight,
        },
        info: {
          Title: `Devis ${data.quoteNumber}`,
          Author: 'Nexus Réussite',
          Subject: `Proposition d’accompagnement — ${data.studentName}`,
          Creator: 'Nexus Réussite — Assistant devis',
        },
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      drawHeader(doc, data);
      const GAP = 18;
      let curY = 148;
      curY = drawPartyBoxes(doc, data, curY) + GAP;
      curY = drawRecommendation(doc, data, curY) + GAP;
      curY = drawSummaryTable(doc, data, curY) + GAP;
      drawInstallmentsAndInclusions(doc, data, curY);
      drawFooter(doc, 1);
      drawPageTwo(doc, data);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
