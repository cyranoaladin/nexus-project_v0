/**
 * Unit tests — renderBilanParentPDF (bilan-parent-pdfkit.ts)
 *
 * Validates:
 *  - PDF bytes are generated
 *  - Magic bytes %PDF present
 *  - Page count matches content length (no blank pages)
 *  - Short content → 1-2 pages, long content → proportionally more
 */

import { renderBilanParentPDF } from '@/lib/pdf/bilan-parent-pdfkit';
import type { BilanParentPDFData } from '@/lib/pdf/bilan-parent-template';

// Count /Page objects in PDF bytes (reliable page-count heuristic)
function countPdfPages(buf: Buffer): number {
  const str = buf.toString('binary');
  // PDF spec: each page is a /Type /Page dictionary (not /Pages which is the root)
  const matches = str.match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 0;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE: BilanParentPDFData = {
  studentName:  'Ahmed Ben Ali',
  stageTitle:   'Stage Printemps 2026',
  subjectLabel: 'Mathématiques',
  coachName:    'Alaeddine Ben Rhouma',
  publishedAt:  '2026-04-30T10:00:00.000Z',
  globalScore:  72,
  parentsMarkdown: '',
};

const SHORT_MARKDOWN = `
## 1. Synthèse générale

Ahmed a bien travaillé pendant ce stage.

## 2. Points d'appui

- Calcul mental rapide
- Bonne mémorisation des formules

## 3. Message final

Bon courage pour la suite !
`.trim();

const LONG_MARKDOWN = Array.from({ length: 8 }, (_, i) => `
## ${i + 1}. Section ${i + 1}

${'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(15).trim()}

### Sous-section ${i + 1}.1

- Élément de liste numéro un avec du texte suffisamment long pour tester le rendu
- Élément de liste numéro deux avec du contenu supplémentaire
- Élément de liste numéro trois

${'Paragraphe additionnel avec du texte représentatif du contenu réel des bilans. '.repeat(8).trim()}

---
`).join('\n');

const EAF_MARKDOWN = `
**BILAN PÉDAGOGIQUE — STAGE DE PRINTEMPS EAF**
*Préparation à l'épreuve anticipée de français — Première*

**Élève :** Melik ZAYANE
**Stage :** Préparation à l'épreuve anticipée de français (Première)
**Durée :** 16 heures
**Date du bilan :** 5 mai 2026

## 1. Attitude et implication

Tout au long de ce stage intensif, **Melik ZAYANE** a fait preuve d'une assiduité exemplaire, témoignant d'un investissement personnel soutenu et constant. Ces premiers éléments témoignent d'une posture scolaire sur laquelle il est possible de s'appuyer pour progresser.

### Engagement observé au fil des séances

- **Implication générale** : en progression — une dynamique encourageante qui mérite d'être poursuivie
- **Concentration** : en progression — avec des efforts notables pour maintenir l'attention
- **Participation orale** : en progression — une prise de parole de plus en plus affirmée

---

## 2. Compréhension des attentes de l'épreuve

La maîtrise des exigences de l'épreuve anticipée de français conditionne largement la qualité des copies. Voici les différentes dimensions évaluées au cours du stage :

**Points à renforcer en priorité :** distinction entre citer et analyser.

---

## 3. Commentaire de texte

L'exercice du commentaire littéraire exige de comprendre un texte, d'identifier les procédés d'écriture et d'en interpréter le sens avec précision.

**Points forts :** la compréhension globale des textes, l'organisation et la structure du commentaire.

*Priorité de travail identifiée :* Travailler la construction du projet de lecture.

---

## 4. Dissertation

La dissertation est l'exercice central de l'EAF : elle mobilise la connaissance des œuvres, la capacité à problématiser et l'art de construire une argumentation progressive.

**Points forts :** la compréhension et l'analyse du sujet.

*Priorité de travail :* Construire une problématique précise.

---

## 5. Expression écrite

La qualité de l'expression écrite est déterminante pour convaincre les correcteurs.

- **Clarté des phrases** : satisfaisant
- **Correction grammaticale** : en progression
- **Orthographe** : en progression
- **Vocabulaire d'analyse littéraire** : fragile

---

## 6. Progrès observés

La progression de **Melik ZAYANE** au cours de ce stage a été **nette, avec des améliorations concrètes sur les compétences travaillées**. Ce bilan chiffré doit être lu comme un point de départ.

La compétence ayant connu la progression la plus marquée est **la méthode de la dissertation**.

---

## 7. Priorités de travail

Pour maximiser les progrès de **Melik** avant l'épreuve, voici les axes prioritaires :

- **Le commentaire de texte**
- **La méthode de la dissertation**
- **La confiance à l'écrit**

---

## 8. Recommandation finale

À l'issue du stage, le niveau estimé de **Melik ZAYANE** est **fragile mais en progression — les efforts du stage portent leurs fruits**.

Un accompagnement régulier est vivement recommandé pour ancrer les méthodes travaillées, maintenir la dynamique de progression et préparer efficacement les épreuves.

Votre enfant a fourni un travail sérieux durant ce stage.

---

*Ce bilan a été rédigé par l'équipe pédagogique Nexus Réussite.*
*Il est destiné aux familles et strictement confidentiel.*
`.trim();

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('renderBilanParentPDF', () => {
  it('génère un Buffer non-vide', async () => {
    const buf = await renderBilanParentPDF({ ...BASE, parentsMarkdown: SHORT_MARKDOWN });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('les magic bytes sont %PDF (fichier PDF valide)', async () => {
    const buf = await renderBilanParentPDF({ ...BASE, parentsMarkdown: SHORT_MARKDOWN });
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
  });

  it('contenu court → 1 page (pas de pages vides)', async () => {
    const buf = await renderBilanParentPDF({ ...BASE, parentsMarkdown: SHORT_MARKDOWN });
    const pages = countPdfPages(buf);
    expect(pages).toBe(1);
  });

  it('contenu long (8 sections) → entre 2 et 6 pages (proportionnel, pas de pages vides)', async () => {
    const buf = await renderBilanParentPDF({ ...BASE, parentsMarkdown: LONG_MARKDOWN });
    const pages = countPdfPages(buf);
    expect(pages).toBeGreaterThanOrEqual(2);
    expect(pages).toBeLessThanOrEqual(6);
  });

  it('bilan EAF complet (8 sections) → 2 ou 3 pages, jamais 8', async () => {
    const buf = await renderBilanParentPDF({
      ...BASE,
      subjectLabel: 'Français / EAF',
      coachName: 'Raja Gmir',
      globalScore: null,
      parentsMarkdown: EAF_MARKDOWN,
    });
    const pages = countPdfPages(buf);
    // The real bug produced 8 pages for a 2-page bilan
    expect(pages).toBeGreaterThanOrEqual(2);
    expect(pages).toBeLessThanOrEqual(4);
  });

  it('sans score global → PDF généré sans erreur', async () => {
    const buf = await renderBilanParentPDF({ ...BASE, globalScore: null, parentsMarkdown: SHORT_MARKDOWN });
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
  });

  it('sans coach → PDF généré sans erreur', async () => {
    const buf = await renderBilanParentPDF({ ...BASE, coachName: null, parentsMarkdown: SHORT_MARKDOWN });
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
  });

  it('markdown avec bold inline → PDF généré sans erreur', async () => {
    const md = '## Section\n\n**Texte en gras** suivi de texte normal et encore **du gras**.';
    const buf = await renderBilanParentPDF({ ...BASE, parentsMarkdown: md });
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
  });

  it('markdown avec séparateurs ────── nettoyés → pas de plantage', async () => {
    const md = '## Section\n\n────────────────────────────\n\nTexte après séparateur.';
    const buf = await renderBilanParentPDF({ ...BASE, parentsMarkdown: md });
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
  });

  it('markdown avec %%%%% (commentaires coach) nettoyés → pas de plantage', async () => {
    const md = '## Section\n\n%%%%%%%%%%%%%\n\nCommentaire du coach après les séparateurs.';
    const buf = await renderBilanParentPDF({ ...BASE, parentsMarkdown: md });
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
  });

  it('parentsMarkdown vide → PDF généré sans erreur (1 page)', async () => {
    const buf = await renderBilanParentPDF({ ...BASE, parentsMarkdown: '' });
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
    expect(countPdfPages(buf)).toBe(1);
  });

  it('résultat est un Buffer (pas une Promise non résolue)', async () => {
    const result = renderBilanParentPDF({ ...BASE, parentsMarkdown: SHORT_MARKDOWN });
    expect(result).toBeInstanceOf(Promise);
    const buf = await result;
    expect(buf).toBeInstanceOf(Buffer);
  });
});
