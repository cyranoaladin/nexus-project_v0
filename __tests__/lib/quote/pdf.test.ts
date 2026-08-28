import { writeFile, rm } from 'fs/promises';
import { execFileSync } from 'child_process';
import path from 'path';

import { renderQuotePDF, type QuotePDFData } from '@/lib/quote/pdf';

const SAMPLE_QUOTE: QuotePDFData = {
  quoteNumber: 'NX-20260614-0001',
  generatedAt: '14 juin 2026',
  validUntil: '21 juin 2026',
  studentName: 'Élève Premium PDF',
  parentName: 'Parent Premium PDF',
  whatsapp: '+216 99 192 829',
  email: 'parent.pdf@nexus-reussite.test',
  advisor: 'Assistante Nexus',
  level: 'Terminale',
  status: 'Scolarisé — lycée homologué AEFE',
  establishment: 'Lycée test homologué',
  languages: 'Anglais / Espagnol',
  currentLevel: "Solide, vise l'excellence",
  specialites: ['Maths', 'Physique-Chimie'],
  options: [],
  modalite: 'À déterminer avec la famille',
  objectif: "Dossier sélectif CPGE, médecine, écoles d'ingénieurs",
  budget: 'Standard',
  mode: 'Présentiel',
  reduction: '0%',
  reductionLabels: [],
  hasDirectionOverride: false,
  offer: {
    label: 'Excellence Terminale',
    desc: 'Deux spécialités + Mathématiques expertes pour dossiers sélectifs.',
    annualDisplay: '9 594 TND / an',
    inc: [
      'Deux spécialités + Maths expertes',
      'Stages, bacs blancs et Grand Oral scientifique',
      'Préparation Parcoursup et suivi renforcé',
    ],
    ech: [
      { label: 'Réservation', amount: 1500 },
      { label: 'Versement 1', amount: 2100 },
      { label: 'Versement 2', amount: 3300 },
      { label: 'Solde', amount: 2694 },
    ],
  },
  alternatives: [
    {
      label: 'Duo Terminale Nexus',
      desc: 'Deux spécialités avec stages et Grand Oral.',
      annualDisplay: '7 175 TND / an',
    },
  ],
};

async function extractPdfText(buffer: Buffer) {
  const pdfPath = path.join('/tmp', `quote-pdfkit-${Date.now()}.pdf`);
  await writeFile(pdfPath, buffer);
  try {
    return runPdfTool('pdftotext', ['-layout', pdfPath, '-']);
  } finally {
    await rm(pdfPath, { force: true });
  }
}

async function getPdfInfo(buffer: Buffer) {
  const pdfPath = path.join('/tmp', `quote-pdfkit-info-${Date.now()}.pdf`);
  await writeFile(pdfPath, buffer);
  try {
    return runPdfTool('pdfinfo', [pdfPath]);
  } finally {
    await rm(pdfPath, { force: true });
  }
}

async function getPdfImages(buffer: Buffer) {
  const pdfPath = path.join('/tmp', `quote-pdfkit-images-${Date.now()}.pdf`);
  await writeFile(pdfPath, buffer);
  try {
    return runPdfTool('pdfimages', ['-list', pdfPath]);
  } finally {
    await rm(pdfPath, { force: true });
  }
}

function runPdfTool(command: string, args: string[]) {
  try {
    return execFileSync(command, args, { encoding: 'utf8' });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(`${command} failed while inspecting quote PDF: ${details}`);
  }
}

describe('renderQuotePDF', () => {
  it('renders a real A4 quote PDF without client-side HTML capture artifacts', async () => {
    const pdf = await renderQuotePDF(SAMPLE_QUOTE);

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(10_000);
    expect(pdf.toString('latin1')).not.toContain('jsPDF');

    const info = await getPdfInfo(pdf);
    expect(info).toContain('Producer:        PDFKit');
    expect(info).toContain('Pages:           2');
    expect(info).toContain('Page size:       595.28 x 841.89 pts (A4)');

    const images = await getPdfImages(pdf);
    expect(images).toMatch(/\bimage\b/);

    const text = await extractPdfText(pdf);
    expect(text).toContain('PROPOSITION');
    expect(text).toContain('Votre Avenir, Notre Passion');
    expect(text).toContain('NX-20260614-0001');
    expect(text).toContain('M&M ACADEMY');
    expect(text).toContain('Parent Premium PDF');
    expect(text).toContain('Élève Premium PDF');
    expect(text).toContain('Excellence Terminale');
    expect(text).toContain('9 594 TND / an');
    expect(text).toContain('1 500 TND');
    expect(text).toContain('Échéancier indicatif');
    expect(text).toContain('Conditions de validation');
    expect(text).toContain('proposition non contractuelle');
  });

  it('Lot 5 confinement: renders the provisional-estimate notice when regulatoryDisclaimer is set', async () => {
    const pdf = await renderQuotePDF({
      ...SAMPLE_QUOTE,
      regulatoryDisclaimer:
        'Cette estimation est provisoire et ne garantit pas que toutes les épreuves listées restent à présenter.',
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const text = await extractPdfText(pdf);
    expect(text).toContain('ESTIMATION PROVISOIRE');
    expect(text).toContain('Cette estimation est provisoire');
  });

  it('omits the provisional-estimate notice when regulatoryDisclaimer is absent (every non-candidat-individuel product line)', async () => {
    const pdf = await renderQuotePDF(SAMPLE_QUOTE);
    const text = await extractPdfText(pdf);
    expect(text).not.toContain('ESTIMATION PROVISOIRE');
  });

  it('mission "vers un produit complet" §4: stays exactly 2 pages, with no draft banner or carte-examen content, when carteExamen is absent (every legacy quote — additive-only regression proof)', async () => {
    const pdf = await renderQuotePDF(SAMPLE_QUOTE);
    const info = await getPdfInfo(pdf);
    expect(info).toContain('Pages:           2');
    const text = await extractPdfText(pdf);
    expect(text).not.toContain('BROUILLON INTERNE');
    expect(text).not.toContain("Carte d'examen");
  });

  it('mission "vers un produit complet" §4: renders a 3rd page with the carte-examen detail and the draft banner when carteExamen is present, never a cost/margin figure', async () => {
    const pdf = await renderQuotePDF({
      ...SAMPLE_QUOTE,
      draftBannerTitle: 'BROUILLON INTERNE — NE PAS ENVOYER',
      regulatoryDisclaimer: 'Ce document est un brouillon interne : une revue humaine est nécessaire avant toute émission définitive.',
      carteExamen: {
        parcoursLabel: 'P1_LIBRE_2ANS',
        necessiteVerificationHumaine: true,
        epreuves: [
          { libelle: 'Mathématiques', matiere: 'Mathématiques', statut: 'À présenter', coefficient: '8', source: 'Arrêté du 16 juillet 2018' },
          { libelle: 'Histoire-Géo', matiere: 'Histoire-Géo', statut: 'Conservée', coefficient: 'À vérifier', source: 'D. 334-13' },
        ],
        avertissements: ['Rythme compressé — accompagnement renforcé à arbitrer explicitement avec la famille.'],
      },
    });

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const info = await getPdfInfo(pdf);
    expect(info).toContain('Pages:           3');

    const text = await extractPdfText(pdf);
    expect(text).toContain('BROUILLON INTERNE — NE PAS ENVOYER');
    expect(text).toContain("Carte d'examen");
    expect(text).toContain('P1_LIBRE_2ANS');
    expect(text).toContain('REVUE HUMAINE NÉCESSAIRE');
    expect(text).toContain('Mathématiques');
    expect(text).toContain('À vérifier');
    expect(text).toContain('Rythme compressé');
    // The 3-page draft PDF must never carry a cost/margin figure or internal rate.
    expect(text).not.toMatch(/marge|teacherCost|costPolicy|TND\/h/i);
  });

  it('mission "vers un produit complet" §5 visual QA finding: an 11-row échéancier (D4 — 25% acompte + 10 mensualités, the real production shape) never overflows the fixed-position footer', async () => {
    const echeancier = [
      { label: 'Acompte (25%, non remboursable sauf non-ouverture du groupe)', amount: 5850 },
      ...Array.from({ length: 9 }, (_, i) => ({ label: `Mensualité ${i + 1}/10`, amount: 1755 })),
      { label: 'Mensualité 10/10', amount: 1755 },
    ];
    const pdf = await renderQuotePDF({
      ...SAMPLE_QUOTE,
      offer: { ...SAMPLE_QUOTE.offer, annualDisplay: '23 400 TND / an', ech: echeancier },
    });
    const text = await extractPdfText(pdf);
    // pdftotext -layout preserves top-to-bottom reading order — the
    // échéancier's own TOTAL line must still read before the page footer,
    // proving the box didn't overflow into it (the exact defect found:
    // the height formula capped its estimate at 9 rows while the render
    // loop drew all 11, silently overlapping the footer).
    const totalIndex = text.indexOf('TOTAL');
    const footerIndex = text.indexOf('Votre Avenir, Notre Passion');
    expect(totalIndex).toBeGreaterThan(-1);
    expect(footerIndex).toBeGreaterThan(-1);
    expect(totalIndex).toBeLessThan(footerIndex);
    const info = await getPdfInfo(pdf);
    expect(info).toContain('Pages:           2');
  });

  it('mission "vers un produit complet" §5 visual QA finding: a long `mode` value (the real "Acompte X TND (25%) + mensualités" pattern both PDF adapters produce) never wraps into the objectif line below it', async () => {
    const pdf = await renderQuotePDF({
      ...SAMPLE_QUOTE,
      mode: 'Acompte 5850 TND (25%) + mensualités',
      objectif: 'Baccalauréat général — candidat individuel',
    });
    const text = await extractPdfText(pdf);
    // Both lines must still appear, each intact and in order — a wrap
    // collision would interleave or truncate one into the other.
    const modeIndex = text.indexOf('Acompte 5850 TND');
    const objectifIndex = text.indexOf('Baccalauréat général');
    expect(modeIndex).toBeGreaterThan(-1);
    expect(objectifIndex).toBeGreaterThan(modeIndex);
  });

  it('mission "vers un produit complet" §5 visual QA finding: a single REAL installment (P11 — full payment at booking) never shows the "échéancier à établir" placeholder meant only for a genuinely empty échéancier', async () => {
    const pdfWithRealSingleInstallment = await renderQuotePDF({
      ...SAMPLE_QUOTE,
      offer: { ...SAMPLE_QUOTE.offer, ech: [{ label: 'Paiement intégral à la réservation (P11 — pas d\'échéancier annuel)', amount: 1800 }] },
    });
    const textReal = await extractPdfText(pdfWithRealSingleInstallment);
    expect(textReal).toContain('Paiement intégral');
    expect(textReal).not.toContain('à établir lors de');

    const pdfWithNoInstallment = await renderQuotePDF({
      ...SAMPLE_QUOTE,
      offer: { ...SAMPLE_QUOTE.offer, ech: [] },
    });
    const textEmpty = await extractPdfText(pdfWithNoInstallment);
    expect(textEmpty).toContain('à établir lors de');
  });

  it('T5R4 §FINDING_6 (FAMILY_PDF_PRICE_UNIT): each "Inclus dans le parcours" line shows its amount with an explicit /mois unit, never a bare TND figure that could be confused with the annual total', async () => {
    const pdf = await renderQuotePDF({
      ...SAMPLE_QUOTE,
      offer: {
        ...SAMPLE_QUOTE.offer,
        incPriced: [
          { label: 'Pilotage Nexus (Pilotage)', amount: 150 },
          { label: 'Mathématiques — 4 h/mois (Petit groupe)', amount: 250 },
        ],
      },
    });
    const text = await extractPdfText(pdf);
    expect(text).toContain('150 TND/mois');
    expect(text).toContain('250 TND/mois');
    expect(text).toContain('Tarifs mensuels de référence');
    // The bare (unit-less) form must never appear for these line amounts.
    expect(text).not.toMatch(/\b150 TND(?!\/)/);
    expect(text).not.toMatch(/\b250 TND(?!\/)/);
  });

  it('T5R4 §FINDING_8 (FAMILY_PDF_INTERNAL_SOURCE = FORBIDDEN): the carte-examen table never shows a SOURCE column or any lib/exams-shaped reference string', async () => {
    const pdf = await renderQuotePDF({
      ...SAMPLE_QUOTE,
      carteExamen: {
        parcoursLabel: 'Candidat individuel — parcours sur deux ans',
        necessiteVerificationHumaine: false,
        epreuves: [{ libelle: 'Mathématiques', matiere: 'Mathématiques', statut: 'À présenter', coefficient: '8', source: 'Référentiel session 2027 (lib/exams, Introduction générale)' }],
        avertissements: [],
      },
    });
    const text = await extractPdfText(pdf);
    expect(text).not.toContain('SOURCE');
    expect(text).not.toMatch(/lib\/exams/);
    expect(text).not.toMatch(/lib\/|app\/|\.ts\b/);
  });

  it('T5R4 §FINDING_10: the carte-examen épreuve heading never duplicates itself ("X — X") when matiere and libelle are the same string', async () => {
    const pdf = await renderQuotePDF({
      ...SAMPLE_QUOTE,
      carteExamen: {
        parcoursLabel: 'Terminale',
        necessiteVerificationHumaine: false,
        epreuves: [{ libelle: 'Philosophie', matiere: 'Philosophie', statut: 'À présenter', coefficient: '8', source: 'x' }],
        avertissements: [],
      },
    });
    const text = await extractPdfText(pdf);
    expect(text).not.toMatch(/Philosophie\s*—\s*Philosophie/);
    expect(text).toContain('Philosophie');
  });

  it('T5R4 — a wide "Devis <id>" title (found during final review: some quote ids render wide enough at 18pt to wrap onto a second line and collide with the description below) shrinks to fit on one line instead of wrapping', async () => {
    // The exact real-world shape that reproduced the bug: "Devis " + a
    // 25-char cuid whose character mix (m/w/o — wide glyphs at 18pt bold)
    // happened to overflow the 310pt box, while a narrower-character id
    // (e.g. containing i/l/1) of the same length did not.
    const wideLabel = 'Devis cmtda40m1000io80154wlm66e';
    const pdf = await renderQuotePDF({
      ...SAMPLE_QUOTE,
      offer: { ...SAMPLE_QUOTE.offer, label: wideLabel, desc: 'Description de test placée juste en dessous du titre.' },
    });
    const text = await extractPdfText(pdf);
    // pdftotext -layout preserves reading order: the description must
    // appear strictly after (never merged/overlapping into) the title line.
    const titleIndex = text.indexOf(wideLabel);
    const descIndex = text.indexOf('Description de test placée juste en dessous du titre.');
    expect(titleIndex).toBeGreaterThanOrEqual(0);
    expect(descIndex).toBeGreaterThan(titleIndex);
    // Both must be readable as complete, distinct strings (proof they were
    // never garbled/overlapping into one unreadable blob).
    expect(text).toContain(wideLabel);
  });

  it('T5R5 §FINDING_14 (PDF R2 line wrap): a long "Inclus dans le parcours" label (the real abandoned-specialty shape) wraps onto multiple lines instead of being truncated with an ellipsis — subject, hours and modality all stay readable', async () => {
    // The real label that triggered the finding on the R2 pack PDF: with
    // the old fixed 18pt-per-row box and a 60-char clamp, this got cut to
    // "NSI — spécialité de Première non pours…", hiding "4 h/mois" and
    // the modality entirely.
    const wrappingLabel = 'NSI — spécialité de Première non poursuivie — 4 h/mois (Petit groupe)';
    const pdf = await renderQuotePDF({
      ...SAMPLE_QUOTE,
      offer: {
        ...SAMPLE_QUOTE.offer,
        incPriced: [
          { label: 'Pilotage Nexus (Pilotage)', amount: 150 },
          { label: wrappingLabel, amount: 90 },
        ],
      },
    });
    const text = await extractPdfText(pdf);
    // pdftotext -layout reconstructs the page as visual rows/columns, so a
    // label that now correctly wraps onto a second line (instead of being
    // truncated onto one) can interleave with the neighbouring price column
    // in the flattened extraction order — that's a `-layout` reconstruction
    // artifact, not evidence of anything hidden. What the finding actually
    // forbids is any *word* of the label being swallowed behind an
    // ellipsis, so assert each full word/fragment survives intact rather
    // than requiring one unbroken phrase.
    const flatText = text.replace(/\s+/g, ' ');
    expect(flatText).not.toContain('…');
    expect(flatText).not.toMatch(/\.\.\./);
    expect(flatText).toContain('NSI');
    expect(flatText).toContain('spécialité de Première non');
    expect(flatText).toContain('poursuivie');
    expect(flatText).toContain('4 h/mois');
    expect(flatText).toContain('Petit groupe');
    expect(flatText).toContain('90 TND/mois');
  });
});
