/**
 * Candidats libres 2027 — aucune valeur en dur hors du module de données.
 *
 * Ce garde existe pour empêcher une régression, pas pour constater un état.
 * Il est né de deux fautes réelles, livrées en production :
 *   · « ou 9 mensualités de 580 TND dès octobre » — soit 5 220 TND pour un
 *     parcours affiché à 5 200 TND sur la même ligne ;
 *   · « Nous confirmons l'ouverture le 06/11 en Terminale et le 16/11 en
 *     Première » — deux dates postérieures aux premiers cours.
 * Dans les deux cas la donnée était juste : c'est la prose qui mentait. Une
 * valeur recopiée dans une phrase ne suit pas la correction de la source.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fmtHeures, getCandidatsLibres2027 } from '@/lib/candidats-libres-2027';

/** Surfaces qui vendent le parcours candidats libres : prose, cartes, FAQ, llms.txt. */
const SURFACES = [
  'app/bac-candidat-libre/page.tsx',
  'components/marketing/CandidatsLibresParcours.tsx',
  'content/marketing/bac-candidat-libre.ts',
  'lib/llms-txt.ts',
  'components/marketing/acadomia-inspired.tsx',
  'components/premium/MethodSection.tsx',
];

const source = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8');

/** Toutes les écritures d'un montant : « 5200 », « 5 200 », « 5 200 » (espace fine). */
function ecrituresDuMontant(montant: number): string[] {
  const brut = String(montant);
  const groupe = brut.length > 3 ? `${brut.slice(0, brut.length - 3)} ?${brut.slice(-3)}` : brut;
  return [brut, groupe.replace(' ?', ' '), groupe.replace(' ?', ' '), groupe.replace(' ?', ' ')];
}

describe('Candidats libres 2027 — aucune valeur en dur hors du module', () => {
  const data = getCandidatsLibres2027();

  const montants = new Set<number>();
  for (const p of data.parcours) {
    montants.add(p.prix_annuel);
    montants.add(p.comptant);
    for (const e of [p.echeancier_9, p.echeancier_8]) {
      montants.add(e.mensualite);
      montants.add(e.derniere);
    }
  }
  montants.add(data.frais_dossier.montant);
  for (const n of data.semaine_diagnostic.niveaux) montants.add(n.prix);
  for (const produit of data.produits_courts.produits) montants.add(produit.prix);
  montants.add(data.avantages.parrainage_tnd);

  test.each([...montants].sort((a, b) => a - b))('le montant %i n’est écrit dans aucune surface', (montant) => {
    for (const chemin of SURFACES) {
      const texte = source(chemin);
      for (const ecriture of ecrituresDuMontant(montant)) {
        // Un montant ne doit apparaître qu'interpolé depuis la donnée.
        expect(texte).not.toContain(`${ecriture} TND`);
        expect(texte).not.toContain(`${ecriture} TND`);
      }
    }
  });

  test('aucune date au format JJ/MM n’est écrite en dur', () => {
    const dates = [
      data.calendrier.decision_ouverture,
      data.calendrier.premiers_cours,
      data.semaine_diagnostic.deduit_si_inscription_avant,
      ...data.parcours.map((p) => p.frais_dossier_offerts_jusqu_au).filter((d): d is string => Boolean(d)),
      ...data.parcours.map((p) => p.cyclades.cloture.slice(0, 10)),
    ];
    for (const chemin of SURFACES) {
      const texte = source(chemin);
      for (const iso of dates) {
        const [, mois, jour] = iso.slice(0, 10).split('-');
        // Ces dates se déplacent d'une session à l'autre : elles passent par jourMois().
        expect(texte).not.toContain(`${jour}/${mois}`);
      }
    }
  });

  test('le seuil d’ouverture et le délai de remboursement ne sont jamais écrits en chiffres', () => {
    for (const chemin of SURFACES) {
      const texte = source(chemin);
      for (const n of [...Array(13).keys()]) {
        expect(texte).not.toContain(`${n} inscrits`);
        expect(texte).not.toContain(`sous ${n} jours`);
      }
    }
  });

  test('les volumes horaires et le nombre de copies ne sont jamais écrits en dur', () => {
    for (const chemin of SURFACES) {
      const texte = source(chemin);
      for (const p of data.parcours) {
        expect(texte).not.toContain(`${p.heures_cours} h`);
        expect(texte).not.toContain(`${p.heures_cours} h`);
        expect(texte).not.toContain(`${p.copies_corrigees} copies`);
        // Le total encadré est affiché ET déclaré en JSON-LD : recopié dans une
        // surface, il cesserait de suivre heures_encadrees_total, et les deux
        // chiffres divergeraient sans que rien ne le signale.
        for (const ecriture of [String(p.heures_encadrees_total), fmtHeures(p.heures_encadrees_total)]) {
          expect(texte).not.toContain(`${ecriture} h`);
          expect(texte).not.toContain(`${ecriture} h`);
        }
      }
    }
  });
});
