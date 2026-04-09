'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { ChevronDown, ChevronUp, Code2, Star } from 'lucide-react';

const PythonIDE = dynamic(() => import('../PythonIDE'), { ssr: false });

/**
 * CdC §4.5 — Pre-loaded Python exercises
 * Marche aléatoire, estimation de π, suite récurrente, recherche de seuil.
 */

interface PythonExercise {
  id: string;
  titre: string;
  description: string;
  code: string;
  expectedOutput?: string;
  difficulty: 1 | 2 | 3;
}

const exercises: PythonExercise[] = [
  {
    id: 'suite-recurrente',
    titre: 'Calcul de termes (suite récurrente)',
    description: 'Calculer u_10 pour u_0 = 1, u_{n+1} = 2*u_n + 1. Résultat attendu : 1023',
    code: `# Suite récurrente : u_0 = 1, u_{n+1} = 2*u_n + 1
# Calcule u_10 et affiche le résultat

def suite(n):
    u = 1
    for i in range(n):
        u = 2 * u + 1
    return u

print(suite(10))`,
    expectedOutput: '1023',
    difficulty: 1,
  },
  {
    id: 'recherche-seuil',
    titre: 'Recherche de seuil (boucle while)',
    description: 'Trouver le plus petit n tel que u_n > 1000 pour u_0 = 2, u_{n+1} = u_n + 3. Résultat : 333',
    code: `# Recherche de seuil : u_0 = 2, u_{n+1} = u_n + 3
# Trouver le plus petit n tel que u_n > 1000

u = 2
n = 0
while u <= 1000:
    u = u + 3
    n = n + 1

print(n)`,
    expectedOutput: '333',
    difficulty: 1,
  },
  {
    id: 'somme-termes',
    titre: 'Somme de termes (accumulateur)',
    description: 'Calculer la somme 1 + 2 + ... + 100. Résultat attendu : 5050',
    code: `# Somme des entiers de 1 à 100
# Utiliser un accumulateur

s = 0
for i in range(1, 101):
    s = s + i

print(s)`,
    expectedOutput: '5050',
    difficulty: 1,
  },
  {
    id: 'estimation-pi',
    titre: 'Estimation de π (Monte-Carlo)',
    description: 'Estimer π en lançant 10000 points aléatoires dans un carré [0,1]².',
    code: `import random

# Estimation de pi par Monte-Carlo
# Lancer N points dans [0,1]²
# Compter ceux dans le quart de cercle

N = 10000
inside = 0

for _ in range(N):
    x = random.random()
    y = random.random()
    if x**2 + y**2 <= 1:
        inside += 1

pi_approx = 4 * inside / N
print(f"pi ≈ {pi_approx:.4f}")`,
    difficulty: 2,
  },
  {
    id: 'marche-aleatoire',
    titre: 'Marche aléatoire',
    description: 'Simuler une marche aléatoire de 100 pas (+1 ou -1 avec probabilité 1/2).',
    code: `import random

# Marche aléatoire : 100 pas
# À chaque pas : +1 (proba 1/2) ou -1 (proba 1/2)

position = 0
n_pas = 100

for _ in range(n_pas):
    if random.random() < 0.5:
        position += 1
    else:
        position -= 1

print(f"Position finale après {n_pas} pas : {position}")`,
    difficulty: 2,
  },
  {
    id: 'galton',
    titre: 'Planche de Galton',
    description: 'Simuler 1000 billes sur une planche de Galton à 10 niveaux.',
    code: `import random

# Planche de Galton : 1000 billes, 10 niveaux
# À chaque niveau, la bille va à droite (proba 1/2) ou reste

n_billes = 1000
n_niveaux = 10
compteur = [0] * (n_niveaux + 1)

for _ in range(n_billes):
    position = 0
    for _ in range(n_niveaux):
        if random.random() < 0.5:
            position += 1
    compteur[position] += 1

# Afficher l'histogramme
for i in range(n_niveaux + 1):
    barre = "#" * (compteur[i] // 5)
    print(f"{i:2d} | {barre} ({compteur[i]})") `,
    difficulty: 3,
  },
];

export default function PythonExercises() {
  const [selectedEx, setSelectedEx] = useState<string>(exercises[0].id);
  const [expanded, setExpanded] = useState(false);

  const currentEx = exercises.find((e) => e.id === selectedEx) ?? exercises[0];

  return (
    <div className="bg-slate-900/50 border border-green-500/20 rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Code2 className="h-5 w-5 text-green-300" aria-hidden="true" />
          <span className="font-bold text-green-300 text-sm">Exercices Python</span>
          <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">{exercises.length} exercices</span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-slate-500" aria-hidden="true" /> : <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />}
      </button>

      {expanded && (
        <div className="p-4 pt-0 space-y-3">
          {/* Exercise selector */}
          <div className="flex flex-wrap gap-2">
            {exercises.map((ex) => (
              <button
                key={ex.id}
                onClick={() => setSelectedEx(ex.id)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                  selectedEx === ex.id
                    ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                    : 'bg-slate-800 text-slate-300 hover:text-white border border-transparent'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">{Array.from({ length: ex.difficulty }).map((_, idx) => <Star key={idx} className="h-3 w-3 fill-current" aria-hidden="true" />)}<span>{ex.titre}</span></span>
              </button>
            ))}
          </div>

          {/* Description */}
          <div className="bg-slate-800/50 rounded-lg p-3 text-xs text-slate-300">
            {currentEx.description}
          </div>

          {/* Python IDE with pre-loaded code */}
          <PythonIDE
            initialCode={currentEx.code}
            expectedOutput={currentEx.expectedOutput}
          />
        </div>
      )}
    </div>
  );
}
