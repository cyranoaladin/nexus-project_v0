import 'server-only';
import terminale from './bilan-terminale-corrections.json';

/** Réservé à la relecture pédagogique authentifiée. */
export const bilanCorrections: Record<string, { expected: string; focus: string }> = {
  ...terminale,
  "3-div": {
    "expected": "Égalité vraie, mais 27 ≥ 16. La division euclidienne est 347 = 16 × 21 + 11, avec 0 ≤ 11 < 16.",
    "focus": "Distinguer égalité exacte et division euclidienne ; contrôler la borne du reste."
  },
  "3-prime-task": {
    "expected": "143 = 11 × 13, donc 143 n’est pas premier. 144 = 12², donc c’est un carré parfait.",
    "focus": "Ne pas arrêter la recherche de diviseurs après 2, 3 et 5 ; distinguer les propriétés."
  },
  "3-lots": {
    "expected": "18 impossible : 48 n’est pas divisible par 18. 24 possible : 72 = 24 × 3 et 48 = 24 × 2. Chaque sachet contient 3 crayons et 2 gommes.",
    "focus": "Vérifier les deux stocks ; distinguer nombre de sachets et contenu."
  },
  "3-reduce-task": {
    "expected": "84 = 2² × 3 × 7 ; 126 = 2 × 3² × 7 ; 84/126 = 2/3. Aucun diviseur commun de 2 et 3 n’est supérieur à 1.",
    "focus": "Décomposition complète, facteurs communs et justification de l’irréductibilité."
  },
  "3-fraction-task": {
    "expected": "Après lundi : 3/5. Mardi : (1/3) × (3/5) = 1/5 du livre. Reste : 3/5 − 1/5 = 2/5.",
    "focus": "Identifier le tout auquel se rapporte chaque fraction."
  },
  "3-power-task": {
    "expected": "−3² = −9 ; (−3)² = 9. Dans la première écriture, on prend l’opposé du carré de 3.",
    "focus": "Priorité de la puissance et portée du signe moins."
  },
  "3-geo-task": {
    "expected": "DE/AB = DF/AC = EF/BC = 1,5 ; A ↔ D, B ↔ E, C ↔ F. Aire de DEF : 6 × 1,5² = 13,5 cm².",
    "focus": "Trois rapports cohérents, correspondances, aire multipliée par k²."
  },
  "3-logic-task": {
    "expected": "Réciproque : si un entier est divisible par 3, alors il est divisible par 6. Elle est fausse ; 9 est un contre-exemple (3 convient aussi).",
    "focus": "Inverser hypothèse et conclusion ; produire un contre-exemple valide."
  },
  "2-sign": {
    "expected": "(6 + 3)/3 = 9/3 = 3, ou 6/3 + 3/3 = 2 + 1. Le dénominateur porte sur toute la somme.",
    "focus": "Portée de la barre de fraction ; simplification d’un seul terme interdite."
  },
  "2-sets-task": {
    "expected": "√49 = 7 : ℕ ; −3 : ℤ ; 2/5 = 0,4 : 𝔻 ; √2 : ℝ (irrationnel).",
    "focus": "Transformer avant de classer ; ne pas confondre apparence et nature d’un nombre."
  },
  "2-arith-task": {
    "expected": "180 = 2² × 3² × 5. Pour 97, il suffit de tester 2, 3, 5, 7 car 9² < 97 < 10². Aucun ne divise 97, donc 97 est premier.",
    "focus": "Facteurs tous premiers ; borne de recherche justifiée."
  },
  "2-proof-task": {
    "expected": "n² + n = n(n + 1). Deux entiers consécutifs comprennent un entier pair ; leur produit est donc pair. Une étude de cas pair/impair exacte convient.",
    "focus": "Passage de l’exemple à la preuve ; conclusion reliée à la définition."
  },
  "2-power-task": {
    "expected": "a) −9 + 16 = 7. b) 10^(3 − 5 − (−4)) = 10².",
    "focus": "Priorité de la puissance ; soustraction d’un exposant négatif."
  },
  "2-roots-task": {
    "expected": "√50 = √(25 × 2) = 5√2 ; √((−7)²) = √49 = 7. La racine carrée est positive ou nulle.",
    "focus": "Extraire un carré parfait ; distinguer √(a²) et a pour a négatif."
  },
  "2-compare-task": {
    "expected": "Les deux nombres sont positifs ; 2,6² = 6,76 < 7, donc 2,6 < √7.",
    "focus": "Justifier la comparaison par les carrés en précisant la positivité."
  }
};
