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

export function genTrigonometrie(rng = Math.random): GeneratedExercise {
  const angles = [0, 30, 45, 60, 90, 120, 135, 150, 180];
  const angleDeg = angles[rndInt(0, angles.length - 1, rng)];
  const angleRad = angleDeg * Math.PI / 180;
  const funcs = ['cos', 'sin'] as const;
  const func = funcs[rndInt(0, 1, rng)];
  const value = func === 'cos' ? Math.cos(angleRad) : Math.sin(angleRad);
  // Format exact values
  const exactValues: Record<string, Record<number, string>> = {
    cos: { 0: '1', 30: '\\sqrt{3}/2', 45: '\\sqrt{2}/2', 60: '1/2', 90: '0', 120: '-1/2', 135: '-\\sqrt{2}/2', 150: '-\\sqrt{3}/2', 180: '-1' },
    sin: { 0: '0', 30: '1/2', 45: '\\sqrt{2}/2', 60: '\\sqrt{3}/2', 90: '1', 120: '\\sqrt{3}/2', 135: '\\sqrt{2}/2', 150: '1/2', 180: '0' },
  };
  const reponse = exactValues[func][angleDeg] || value.toFixed(2);
  return {
    question: `Calculer $${func}(${angleDeg}°)$.`,
    reponse: `$${reponse}$`,
    explication: `Valeur remarquable : $${func}(${angleDeg}°) = ${reponse}$.`,
  };
}

export function genVariablesAleatoires(rng = Math.random): GeneratedExercise {
  const values = [1, 2, 3, 4];
  const probs = [0.2, 0.3, 0.1, 0.4];
  // Calculate E(X)
  const esperance = values.reduce((sum, v, i) => sum + v * probs[i], 0);
  return {
    question: `Soit $X$ avec loi : $P(X=1)=0.2$, $P(X=2)=0.3$, $P(X=3)=0.1$, $P(X=4)=0.4$. Calculer $E(X)$.`,
    reponse: esperance,
    tolerance: 0.01,
    explication: `$E(X) = 1\\times0.2 + 2\\times0.3 + 3\\times0.1 + 4\\times0.4 = 0.2 + 0.6 + 0.3 + 1.6 = ${esperance}$.`,
  };
}

export function genExponentielle(rng = Math.random): GeneratedExercise {
  const a = rndInt(2, 5, rng);
  const x = rndInt(-2, 2, rng);
  const result = Math.pow(a, x);
  return {
    question: `Calculer $${a}^{${x}}$.`,
    reponse: result,
    tolerance: 0.001,
    explication: `$${a}^{${x}} = ${result}$.`,
  };
}

export const GENERATORS: Record<string, (rng?: () => number) => GeneratedExercise> = {
  'second-degre': genSecondDegre,
  derivation: genDerivee,
  'variations-courbes': genDerivee,
  suites: genSuiteArith,
  'probabilites-cond': genProbaCond,
  'produit-scalaire': genProduitScalaire,
  trigonometrie: genTrigonometrie,
  'variables-aleatoires': genVariablesAleatoires,
  exponentielle: genExponentielle,
};

export type { GeneratedExercise };
