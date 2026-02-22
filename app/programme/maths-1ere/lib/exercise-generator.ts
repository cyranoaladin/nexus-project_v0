import { generateExerciseRandomInt as rndInt, generateExerciseRandomFloat as rndFloat } from './math-engine';

type GeneratedExercise = {
  question: string;
  reponse: number | string;
  tolerance?: number;
  explication: string;
};

export function genSecondDegre(rng = Math.random): GeneratedExercise {
  const x1 = rndInt(-5, 5, rng);
  const x2 = rndInt(-5, 5, rng);
  if (x1 === x2) return genSecondDegre(rng);
  const a = rndInt(1, 3, rng);
  const b = -a * (x1 + x2);
  const c = a * x1 * x2;
  const delta = b * b - 4 * a * c;
  return {
    question: `Résoudre $${a}x^2 ${b >= 0 ? '+' : ''}${b}x ${c >= 0 ? '+' : ''}${c} = 0$.`,
    reponse: `$\\{${Math.min(x1, x2)};\\;${Math.max(x1, x2)}\\}$`,
    explication: `$\\Delta = ${delta}$. $x_1 = ${x1}$, $x_2 = ${x2}$.`,
  };
}

export function genDerivee(rng = Math.random): GeneratedExercise {
  const a = rndInt(-5, 5, rng);
  const b = rndInt(-5, 5, rng);
  const c = rndInt(-10, 10, rng);
  const n = rndInt(2, 5, rng);
  return {
    question: `Dériver $f(x) = ${a}x^${n} ${b >= 0 ? '+' : ''}${b}x ${c >= 0 ? '+' : ''}${c}$.`,
    reponse: `$${a * n}x^${n - 1} ${b >= 0 ? '+' : ''}${b}$`,
    explication: `$(x^n)' = nx^{n-1}$. Ici : $${a * n}x^${n - 1} + ${b}$.`,
  };
}

export function genSuiteArith(rng = Math.random): GeneratedExercise {
  const u0 = rndInt(-10, 10, rng);
  const r = rndInt(-5, 5, rng);
  const n = rndInt(5, 20, rng);
  const un = u0 + n * r;
  return {
    question: `Suite arithmétique : $u_0 = ${u0}$, raison $r = ${r}$. Calculer $u_{${n}}$.`,
    reponse: un,
    tolerance: 0,
    explication: `$u_n = u_0 + n \\times r = ${u0} + ${n} \\times ${r} = ${un}$.`,
  };
}

export function genProbaCond(rng = Math.random): GeneratedExercise {
  const pA = Math.round(rndFloat(0.1, 0.8, 1, rng) * 10) / 10;
  const pBA = Math.round(rndFloat(0.1, 0.9, 1, rng) * 10) / 10;
  const pAnB = Math.round(pA * pBA * 100) / 100;
  return {
    question: `$P(A) = ${pA}$ et $P_A(B) = ${pBA}$. Calculer $P(A \\cap B)$.`,
    reponse: pAnB,
    tolerance: 0.01,
    explication: `$P(A \\cap B) = P(A) \\times P_A(B) = ${pA} \\times ${pBA} = ${pAnB}$.`,
  };
}

export function genProduitScalaire(rng = Math.random): GeneratedExercise {
  const x1 = rndInt(-5, 5, rng);
  const y1 = rndInt(-5, 5, rng);
  const x2 = rndInt(-5, 5, rng);
  const y2 = rndInt(-5, 5, rng);
  const result = x1 * x2 + y1 * y2;
  return {
    question: `Calculer $\\vec{u}(${x1};${y1}) \\cdot \\vec{v}(${x2};${y2})$.`,
    reponse: result,
    tolerance: 0,
    explication: `$${x1} \\times ${x2} + ${y1} \\times ${y2} = ${x1 * x2} + ${y1 * y2} = ${result}$.`,
  };
}

export const GENERATORS: Record<string, (rng?: () => number) => GeneratedExercise> = {
  'second-degre': genSecondDegre,
  derivation: genDerivee,
  'variations-courbes': genDerivee,
  suites: genSuiteArith,
  'probabilites-cond': genProbaCond,
  'produit-scalaire': genProduitScalaire,
};

export type { GeneratedExercise };
