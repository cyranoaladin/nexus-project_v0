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
    return execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' });
  } finally {
    await rm(pdfPath, { force: true });
  }
}

async function getPdfInfo(buffer: Buffer) {
  const pdfPath = path.join('/tmp', `quote-pdfkit-info-${Date.now()}.pdf`);
  await writeFile(pdfPath, buffer);
  try {
    return execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
  } finally {
    await rm(pdfPath, { force: true });
  }
}

async function getPdfImages(buffer: Buffer) {
  const pdfPath = path.join('/tmp', `quote-pdfkit-images-${Date.now()}.pdf`);
  await writeFile(pdfPath, buffer);
  try {
    return execFileSync('pdfimages', ['-list', pdfPath], { encoding: 'utf8' });
  } finally {
    await rm(pdfPath, { force: true });
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
});
