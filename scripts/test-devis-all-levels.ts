/**
 * Test script — Generate a complete quote PDF for each level
 * Run: npx tsx scripts/test-devis-all-levels.ts
 */
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { renderQuotePDF, type QuotePDFData } from '../lib/quote/pdf';

const OUTPUT_DIR = path.join(process.cwd(), '/tmp/devis-test');
mkdirSync(OUTPUT_DIR, { recursive: true });

// ── Simulated recommendation engine (mirrors app.js decision tree) ──

const OFFER_DB: Record<string, { label: string; annual?: number; monthly?: number; publicAnnual?: number; display?: string; echeancier?: number[]; desc: string; inc: string[] }> = {
  brevetMaths: {
    label: 'Brevet Maths', annual: 2200, monthly: 220,
    echeancier: [550, 550, 550, 550],
    desc: 'Mathématiques et méthode pour préparer le DNB.',
    inc: ['Mathématiques : calcul, géométrie, résolution de problèmes', 'Groupe de 5 max, niveaux homogènes', 'Entraînement DNB : sujets corrigés et méthodologie', 'Bilan de positionnement initial offert', 'Plateforme Nexus + espace parent dédié', 'Bilans de progression réguliers']
  },
  secondeSciences: {
    label: 'Seconde Sciences', annual: 4300, monthly: 430,
    echeancier: [1075, 1075, 1075, 1075],
    desc: 'Maths + sciences pour préparer les choix de spécialités.',
    inc: ['Mathématiques et raisonnement scientifique, 4 h / semaine', 'Groupe de 5 max, niveaux homogènes', 'Préparation aux attendus de Première', 'Bilan de positionnement initial offert', 'Plateforme Nexus + espace parent dédié', 'Aide à l\'arbitrage des spécialités', 'Bilans de progression réguliers']
  },
  premiereDoubleSecurite: {
    label: 'Première Double Sécurité', annual: 4900, monthly: 490, publicAnnual: 5400,
    echeancier: [1200, 1200, 1200, 1300],
    desc: 'Français + maths pour sécuriser le dossier de Première.',
    inc: ['Préparation EAF complète : écrit + oral', 'Mathématiques anticipées et méthode', 'Groupe de 5 max, niveaux homogènes', 'Bacs blancs de français en conditions réelles', 'Bilan de positionnement initial offert', 'Plateforme Nexus illimitée + espace parent dédié', 'Bilans de progression réguliers']
  },
  duoTerminaleNexus: {
    label: 'Duo Terminale Nexus', annual: 7175, monthly: 720, publicAnnual: 7900,
    echeancier: [1200, 1550, 2750, 1675],
    desc: 'Deux spécialités + stages + Grand Oral inclus.',
    inc: ['2 spécialités au choix, 4 h / semaine chacune', 'Groupe de 5 max, niveaux homogènes', 'Grand Oral : préparation complète incluse', 'Stages de vacances inclus (Toussaint, février, Pâques)', 'Bacs blancs en conditions réelles + correction détaillée', 'Plateforme Nexus illimitée + espace parent dédié', 'Bilans de progression réguliers communiqués aux parents', 'Accompagnement Parcoursup et orientation']
  },
};

function buildQuote(level: string, status: string, objectif: string, offerKey: string): QuotePDFData {
  const offer = OFFER_DB[offerKey];
  const ech = (offer.echeancier || []).map((amt, i) => ({
    label: i === 0 ? 'Réservation' : `Trimestre ${i}`,
    amount: amt
  }));

  const names: Record<string, [string, string, string]> = {
    troisieme: ['Yasmine BEN ALI', 'Sami BEN ALI', 'Collège Claudel'],
    seconde: ['Kamel BEN RHOUMA', 'Alaeddine BEN RHOUMA', 'Lycée PMF'],
    premiere: ['Lina TRABELSI', 'Mehdi TRABELSI', 'Lycée Gustave Flaubert'],
    terminale: ['Adam CHAABANE', 'Nadia CHAABANE', 'Lycée Robert Schuman'],
  };
  const [student, parent, school] = names[level] || names.terminale;

  const levelLabels: Record<string, string> = { troisieme: 'Troisième', seconde: 'Seconde', premiere: 'Première', terminale: 'Terminale' };
  const statusLabels: Record<string, string> = { scolarise: 'Scolarisé — lycée homologué AEFE', libre: 'Candidat libre (individuel)', double: 'Double cursus' };
  const objectifLabels: Record<string, string> = { consolider: 'Consolider / sécuriser', mention: 'Viser une mention', selectif: 'Dossier sélectif', rattrapage: 'Rattraper un retard' };

  const specsByLevel: Record<string, string[]> = {
    premiere: ['Mathématiques', 'Physique-Chimie', 'SVT'],
    terminale: ['Mathématiques', 'Physique-Chimie'],
  };

  return {
    quoteNumber: `NX-TEST-${level.toUpperCase()}`,
    generatedAt: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
    validUntil: new Date(Date.now() + 7 * 86400000).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
    studentName: student,
    parentName: parent,
    whatsapp: '+216 54 364 374',
    email: 'parent.test@gmail.com',
    advisor: 'Molka MEZZEZ',
    level: levelLabels[level] || level,
    status: statusLabels[status] || status,
    establishment: school,
    languages: 'Anglais',
    currentLevel: 'Moyen, à consolider',
    specialites: specsByLevel[level] || [],
    options: [],
    modalite: status === 'libre' ? 'Modalité A — étalée' : 'Non applicable',
    objectif: objectifLabels[objectif] || objectif,
    budget: 'Standard',
    mode: 'Présentiel',
    reduction: '0%',
    reductionLabels: [],
    hasDirectionOverride: false,
    publicAnnual: offer.publicAnnual || null,
    monthlyDisplay: offer.monthly ? `≈ ${offer.monthly} TND / mois` : null,
    economie: (offer.publicAnnual && offer.annual) ? offer.publicAnnual - offer.annual : null,
    offer: {
      label: offer.label,
      desc: offer.desc,
      annualDisplay: offer.annual ? `${offer.annual.toLocaleString('fr-FR')} TND / an` : (offer.display || 'Tarif à valider'),
      inc: offer.inc,
      ech,
    },
    alternatives: [],
  };
}

// ── Test cases ──

interface TestCase {
  level: string;
  status: string;
  objectif: string;
  offerKey: string;
  description: string;
}

const TEST_CASES: TestCase[] = [
  { level: 'troisieme', status: 'scolarise', objectif: 'consolider', offerKey: 'brevetMaths', description: 'Troisième — Scolarisé — Consolider' },
  { level: 'seconde', status: 'scolarise', objectif: 'consolider', offerKey: 'secondeSciences', description: 'Seconde — Scolarisé — Consolider' },
  { level: 'premiere', status: 'scolarise', objectif: 'mention', offerKey: 'premiereDoubleSecurite', description: 'Première — Scolarisé — Mention' },
  { level: 'terminale', status: 'scolarise', objectif: 'selectif', offerKey: 'duoTerminaleNexus', description: 'Terminale — Scolarisé — Sélectif' },
];

async function main() {
  console.log('=== Test Devis PDF — Tous niveaux ===\n');

  for (const tc of TEST_CASES) {
    const data = buildQuote(tc.level, tc.status, tc.objectif, tc.offerKey);
    console.log(`📄 ${tc.description}`);
    console.log(`   Offre: ${data.offer.label} — ${data.offer.annualDisplay}`);
    console.log(`   Élève: ${data.studentName} (${data.level} · ${data.status})`);
    console.log(`   Objectif: ${data.objectif}`);
    console.log(`   Échéancier: ${data.offer.ech.map(e => `${e.amount} TND`).join(' + ')}`);
    console.log(`   Inclusions: ${data.offer.inc.length} items`);
    if (data.publicAnnual) console.log(`   Tarif public: ${data.publicAnnual} TND | Économie: ${data.economie} TND`);
    if (data.monthlyDisplay) console.log(`   Mensuel: ${data.monthlyDisplay}`);

    try {
      const buffer = await renderQuotePDF(data);
      const filename = `devis-${tc.level}.pdf`;
      const filepath = path.join(OUTPUT_DIR, filename);
      writeFileSync(filepath, buffer);
      console.log(`   ✅ PDF généré: ${filepath} (${(buffer.length / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.log(`   ❌ ERREUR: ${err instanceof Error ? err.message : err}`);
    }
    console.log('');
  }

  console.log('=== Vérifications de rendu ===\n');

  // Quick check: render a quote with special chars that caused issues
  const specialTest = buildQuote('seconde', 'scolarise', 'consolider', 'secondeSciences');
  specialTest.monthlyDisplay = '≈ 430 TND / mois';
  specialTest.reduction = '10%';
  specialTest.reductionLabels = ['Ancien élève', 'Paiement comptant'];

  try {
    const buffer = await renderQuotePDF(specialTest);
    const filepath = path.join(OUTPUT_DIR, 'devis-special-chars.pdf');
    writeFileSync(filepath, buffer);
    console.log(`✅ Test caractères spéciaux (≈, accents, réductions): ${filepath} (${(buffer.length / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.log(`❌ Test caractères spéciaux ERREUR: ${err instanceof Error ? err.message : err}`);
  }

  // Test with publicAnnual (economie display)
  const savingsTest = buildQuote('terminale', 'scolarise', 'mention', 'duoTerminaleNexus');
  savingsTest.reduction = '5%';
  savingsTest.reductionLabels = ['Early Bird'];

  try {
    const buffer = await renderQuotePDF(savingsTest);
    const filepath = path.join(OUTPUT_DIR, 'devis-economie.pdf');
    writeFileSync(filepath, buffer);
    console.log(`✅ Test économie/tarif public (7 900 vs 7 175 TND): ${filepath} (${(buffer.length / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.log(`❌ Test économie ERREUR: ${err instanceof Error ? err.message : err}`);
  }

  console.log(`\n📁 Tous les PDFs: ${OUTPUT_DIR}/`);
}

main().catch(console.error);
