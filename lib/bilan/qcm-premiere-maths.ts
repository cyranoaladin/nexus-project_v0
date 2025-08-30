// lib/bilan/qcm-premiere-maths.ts
import { QCMQuestion, DomainKey } from './types';

const D = {
  CALC: 'Calcul litteral & equations' as DomainKey,
  FONC: 'Fonctions & graphes' as DomainKey,
  GEOM: 'Geometrie vectorielle/reperee' as DomainKey,
  TRIG: 'Trigonometrie' as DomainKey,
  PROB: 'Probabilites & statistiques' as DomainKey,
  ALGO: 'Algorithmique & logique' as DomainKey,
};

// QCM de 40 questions — pondérations par domaine selon BILAN_PREMIERE_MATHS.md
// Nota: certaines questions initialement "réponse libre" ont été transformées en QCM avec distracteurs plausibles.
export const QCM_PREMIERE_MATHS: QCMQuestion[] = [
  // Partie 1 – Calcul littéral et équations (8 questions, /11 pts)
  { id: 'Q1', domain: D.CALC, text: 'Développer (x+2)(x-3).', choices: [
      { label: 'A', text: 'x^2 - x - 6' },
      { label: 'B', text: 'x^2 - x + 6' },
      { label: 'C', text: 'x^2 - 5x - 6' },
      { label: 'D', text: 'x^2 - x - 2' },
    ], correctIndex: 0, weight: 1 },
  { id: 'Q2', domain: D.CALC, text: 'Factoriser x^2 - 9.', choices: [
      { label: 'A', text: '(x-9)(x+1)' },
      { label: 'B', text: '(x-3)(x+3)' },
      { label: 'C', text: '(x-9)(x-1)' },
      { label: 'D', text: '(x-1)(x+9)' },
    ], correctIndex: 1, weight: 1 },
  { id: 'Q3', domain: D.CALC, text: 'Résoudre 2x+5=11.', choices: [
      { label: 'A', text: 'x=2' },
      { label: 'B', text: 'x=3' },
      { label: 'C', text: 'x=6' },
      { label: 'D', text: 'x=8' },
    ], correctIndex: 1, weight: 1 },
  { id: 'Q4', domain: D.CALC, text: 'Résoudre x^2-5x+6=0.', choices: [
      { label: 'A', text: 'x=2 ou x=3' },
      { label: 'B', text: 'x=1 ou x=6' },
      { label: 'C', text: 'x=-2 ou x=3' },
      { label: 'D', text: 'Aucune solution réelle' },
    ], correctIndex: 0, weight: 2 },
  { id: 'Q5', domain: D.CALC, text: 'L’équation 3x^2+2x+1=0 a :', choices: [
      { label: 'A', text: '2 solutions réelles distinctes' },
      { label: 'B', text: '1 solution double' },
      { label: 'C', text: 'Aucune solution réelle' },
      { label: 'D', text: 'Une infinité de solutions' },
    ], correctIndex: 2, weight: 2 },
  { id: 'Q6', domain: D.CALC, text: 'Résoudre l’inéquation 2x-3>1.', choices: [
      { label: 'A', text: 'x>1' },
      { label: 'B', text: 'x>2' },
      { label: 'C', text: 'x>3' },
      { label: 'D', text: 'x>4' },
    ], correctIndex: 1, weight: 1 },
  { id: 'Q7', domain: D.CALC, text: 'Forme développée de (x+1)^2.', choices: [
      { label: 'A', text: 'x^2+2x+1' },
      { label: 'B', text: 'x^2+x+1' },
      { label: 'C', text: 'x^2-2x+1' },
      { label: 'D', text: 'x^2+1' },
    ], correctIndex: 0, weight: 1 },
  { id: 'Q8', domain: D.CALC, text: 'Polynôme du 2nd degré de racines 1 et -2.', choices: [
      { label: 'A', text: 'x^2 - x - 2' },
      { label: 'B', text: 'x^2 + x - 2' },
      { label: 'C', text: 'x^2 - 3x + 2' },
      { label: 'D', text: 'x^2 + 3x + 2' },
    ], correctIndex: 1, weight: 2 },

  // Partie 2 – Fonctions & représentations (7 q, /9 pts)
  { id: 'Q9', domain: D.FONC, text: 'La fonction affine f(x)=3x-2 est :', choices: [
      { label: 'A', text: 'Croissante' },
      { label: 'B', text: 'Décroissante' },
      { label: 'C', text: 'Constante' },
      { label: 'D', text: 'Non définie' },
    ], correctIndex: 0, weight: 1 },
  { id: 'Q10', domain: D.FONC, text: 'La fonction carré f(x)=x^2 est :', choices: [
      { label: 'A', text: 'Croissante sur R' },
      { label: 'B', text: 'Décroissante sur R+' },
      { label: 'C', text: 'Croissante sur [0,+∞[' },
      { label: 'D', text: 'Constante' },
    ], correctIndex: 2, weight: 1 },
  { id: 'Q11', domain: D.FONC, text: 'Une fonction quadratique f(x)=ax^2+bx+c est convexe si :', choices: [
      { label: 'A', text: 'a<0' },
      { label: 'B', text: 'a=0' },
      { label: 'C', text: 'a>0' },
      { label: 'D', text: 'Toujours' },
    ], correctIndex: 2, weight: 2 },
  { id: 'Q12', domain: D.FONC, text: 'Résoudre graphiquement x^2-1=0.', choices: [
      { label: 'A', text: 'x=0' },
      { label: 'B', text: 'x=1' },
      { label: 'C', text: 'x=-1 et x=1' },
      { label: 'D', text: 'Aucune solution' },
    ], correctIndex: 2, weight: 1 },
  { id: 'Q13', domain: D.FONC, text: 'La parabole y=x^2-4x+3 coupe l’axe Ox en :', choices: [
      { label: 'A', text: 'x=1 et x=3' },
      { label: 'B', text: 'x=-1 et x=3' },
      { label: 'C', text: 'x=1 et x=-3' },
      { label: 'D', text: 'x=0 et x=3' },
    ], correctIndex: 0, weight: 2 },
  { id: 'Q14', domain: D.FONC, text: 'La fonction inverse f(x)=1/x est définie sur :', choices: [
      { label: 'A', text: 'R' },
      { label: 'B', text: 'R* = R \\ {0}' },
      { label: 'C', text: '[0,+∞[' },
      { label: 'D', text: ']-∞,0[' },
    ], correctIndex: 1, weight: 1 },
  { id: 'Q15', domain: D.FONC, text: 'Le tableau de variation d’une fonction permet de :', choices: [
      { label: 'A', text: 'Lire ses limites' },
      { label: 'B', text: 'Étudier croissance/décroissance' },
      { label: 'C', text: 'Trouver son équation' },
      { label: 'D', text: 'Factoriser' },
    ], correctIndex: 1, weight: 1 },

  // Partie 3 – Géométrie vectorielle & repérée (7 q, /11 pts)
  { id: 'Q16', domain: D.GEOM, text: 'u(2,1) et v(4,2). v est ?', choices: [
      { label: 'A', text: 'Colinéaire à u' },
      { label: 'B', text: 'Orthogonal à u' },
      { label: 'C', text: 'Opposé à u' },
      { label: 'D', text: 'Aucun des deux' },
    ], correctIndex: 0, weight: 2 },
  { id: 'Q17', domain: D.GEOM, text: 'Norme de (3,4).', choices: [
      { label: 'A', text: '3' },
      { label: 'B', text: '4' },
      { label: 'C', text: '5' },
      { label: 'D', text: '6' },
    ], correctIndex: 2, weight: 1 },
  { id: 'Q18', domain: D.GEOM, text: '(1,2)·(3,4)=?', choices: [
      { label: 'A', text: '7' },
      { label: 'B', text: '10' },
      { label: 'C', text: '11' },
      { label: 'D', text: '12' },
    ], correctIndex: 2, weight: 2 },
  { id: 'Q19', domain: D.GEOM, text: 'Milieu de A(2,3), B(4,7).', choices: [
      { label: 'A', text: '(3,5)' },
      { label: 'B', text: '(2,5)' },
      { label: 'C', text: '(3,4)' },
      { label: 'D', text: '(6,10)' },
    ], correctIndex: 0, weight: 1 },
  { id: 'Q20', domain: D.GEOM, text: 'Droite passant par (0,2), pente 3.', choices: [
      { label: 'A', text: 'y=2x+3' },
      { label: 'B', text: 'y=3x+2' },
      { label: 'C', text: 'y=3x-2' },
      { label: 'D', text: 'y=2x-3' },
    ], correctIndex: 1, weight: 2 },
  { id: 'Q21', domain: D.GEOM, text: '(x-1)^2+(y-2)^2=9 représente :', choices: [
      { label: 'A', text: 'Cercle centre (1,2) rayon 3' },
      { label: 'B', text: 'Cercle centre (2,1) rayon 9' },
      { label: 'C', text: 'Parabole' },
      { label: 'D', text: 'Ellipse' },
    ], correctIndex: 0, weight: 2 },
  { id: 'Q22', domain: D.GEOM, text: 'Deux vecteurs orthogonaux si :', choices: [
      { label: 'A', text: 'Leur produit scalaire est 1' },
      { label: 'B', text: 'Leur norme est 0' },
      { label: 'C', text: 'Leur produit scalaire vaut 0' },
      { label: 'D', text: 'Ils sont parallèles' },
    ], correctIndex: 2, weight: 1 },

  // Partie 4 – Trigonométrie (5 q, /7 pts)
  { id: 'Q23', domain: D.TRIG, text: 'Point d’angle π/6 sur le cercle trigo :', choices: [
      { label: 'A', text: '(1/2, √3/2)' },
      { label: 'B', text: '(√3/2, 1/2)' },
      { label: 'C', text: '(√2/2, √2/2)' },
      { label: 'D', text: '(0,1)' },
    ], correctIndex: 1, weight: 2 },
  { id: 'Q24', domain: D.TRIG, text: 'cos(π/3)= ?', choices: [
      { label: 'A', text: '0' },
      { label: 'B', text: '1/2' },
      { label: 'C', text: '√3/2' },
      { label: 'D', text: '1' },
    ], correctIndex: 1, weight: 1 },
  { id: 'Q25', domain: D.TRIG, text: 'Période de sin(x).', choices: [
      { label: 'A', text: 'π/2' },
      { label: 'B', text: 'π' },
      { label: 'C', text: '2π' },
      { label: 'D', text: '4π' },
    ], correctIndex: 2, weight: 1 },
  { id: 'Q26', domain: D.TRIG, text: 'La fonction cosinus est :', choices: [
      { label: 'A', text: 'Impaire' },
      { label: 'B', text: 'Paire' },
      { label: 'C', text: 'Ni paire ni impaire' },
      { label: 'D', text: 'Constante' },
    ], correctIndex: 1, weight: 2 },
  { id: 'Q27', domain: D.TRIG, text: 'sin(π/2)= ?', choices: [
      { label: 'A', text: '0' },
      { label: 'B', text: '1/2' },
      { label: 'C', text: '√2/2' },
      { label: 'D', text: '1' },
    ], correctIndex: 3, weight: 1 },

  // Partie 5 – Probabilités & statistiques (7 q, /12 pts)
  { id: 'Q28', domain: D.PROB, text: 'Pièce équilibrée : P(Pile)= ?', choices: [
      { label: 'A', text: '1/4' },
      { label: 'B', text: '1/3' },
      { label: 'C', text: '1/2' },
      { label: 'D', text: '1' },
    ], correctIndex: 2, weight: 1 },
  { id: 'Q29', domain: D.PROB, text: 'Loi de probabilité : somme des probabilités = ?', choices: [
      { label: 'A', text: '0' },
      { label: 'B', text: '1' },
      { label: 'C', text: '2' },
      { label: 'D', text: '100' },
    ], correctIndex: 1, weight: 1 },
  { id: 'Q30', domain: D.PROB, text: 'Espérance: P(X=1)=0,4; P(X=3)=0,6.', choices: [
      { label: 'A', text: '2,0' },
      { label: 'B', text: '2,2' },
      { label: 'C', text: '2,4' },
      { label: 'D', text: '2,6' },
    ], correctIndex: 1, weight: 3 },
  { id: 'Q31', domain: D.PROB, text: 'Moyenne de 4, 6, 10, 0.', choices: [
      { label: 'A', text: '4,5' },
      { label: 'B', text: '5' },
      { label: 'C', text: '6' },
      { label: 'D', text: '5,5' },
    ], correctIndex: 1, weight: 2 },
  { id: 'Q32', domain: D.PROB, text: 'L’écart-type mesure :', choices: [
      { label: 'A', text: 'La moyenne' },
      { label: 'B', text: 'La dispersion' },
      { label: 'C', text: 'Le maximum' },
      { label: 'D', text: 'La somme' },
    ], correctIndex: 1, weight: 2 },
  { id: 'Q33', domain: D.PROB, text: 'Si A et B indépendants : P(A∩B)= ?', choices: [
      { label: 'A', text: 'P(A)+P(B)' },
      { label: 'B', text: 'P(A)×P(B)' },
      { label: 'C', text: 'P(A)/P(B)' },
      { label: 'D', text: 'P(A)-P(B)' },
    ], correctIndex: 1, weight: 2 },
  { id: 'Q34', domain: D.PROB, text: 'Dé équilibré: prob d’un multiple de 2.', choices: [
      { label: 'A', text: '1/6' },
      { label: 'B', text: '2/6' },
      { label: 'C', text: '3/6' },
      { label: 'D', text: '4/6' },
    ], correctIndex: 2, weight: 1 },

  // Partie 6 – Algorithmique & logique (6 q, /8 pts)
  { id: 'Q35', domain: D.ALGO, text: "Python: for i in range(3): print(i)", choices: [
      { label: 'A', text: '1 2 3' },
      { label: 'B', text: '0 1 2' },
      { label: 'C', text: '2 1 0' },
      { label: 'D', text: '3 2 1' },
    ], correctIndex: 1, weight: 1 },
  { id: 'Q36', domain: D.ALGO, text: 'Syntaxe condition Python.', choices: [
      { label: 'A', text: 'if x>0:' },
      { label: 'B', text: 'if (x>0)' },
      { label: 'C', text: 'if x>0 then' },
      { label: 'D', text: 'if x>0 end' },
    ], correctIndex: 0, weight: 1 },
  { id: 'Q37', domain: D.ALGO, text: 'A={1,2,3}, B={2,4}. Intersection ?', choices: [
      { label: 'A', text: '{1,2,3,4}' },
      { label: 'B', text: '{2}' },
      { label: 'C', text: '{1,3,4}' },
      { label: 'D', text: '{1,2}' },
    ], correctIndex: 1, weight: 1 },
  { id: 'Q38', domain: D.ALGO, text: 'Négation de « Tout entier est pair » :', choices: [
      { label: 'A', text: 'Tout entier est impair' },
      { label: 'B', text: 'Il existe un entier impair' },
      { label: 'C', text: 'Il existe un entier pair' },
      { label: 'D', text: 'Aucune' },
    ], correctIndex: 1, weight: 2 },
  { id: 'Q39', domain: D.ALGO, text: 'Formule (P ∨ Q) signifie :', choices: [
      { label: 'A', text: 'P et Q' },
      { label: 'B', text: 'P ou Q' },
      { label: 'C', text: 'Non P' },
      { label: 'D', text: 'Q implique P' },
    ], correctIndex: 1, weight: 1 },
  { id: 'Q40', domain: D.ALGO, text: '« Si carré alors rectangle » :', choices: [
      { label: 'A', text: 'Implication' },
      { label: 'B', text: 'Équivalence' },
      { label: 'C', text: 'Négation' },
      { label: 'D', text: 'Contre-exemple' },
    ], correctIndex: 0, weight: 2 },
];

export const DOMAIN_MAX: Record<DomainKey, number> = {
  [D.CALC]: 11,
  [D.FONC]: 9,
  [D.GEOM]: 11,
  [D.TRIG]: 7,
  [D.PROB]: 12,
  [D.ALGO]: 8,
};

export const DOMAINS_ORDER: DomainKey[] = [
  D.CALC,
  D.FONC,
  D.GEOM,
  D.TRIG,
  D.PROB,
  D.ALGO,
];

