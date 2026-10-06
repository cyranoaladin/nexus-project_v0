/**
 * @jest-environment node
 *
 * Harnais Python du TP POO (content/espace/nsi-poo/runner.py), exécuté avec le
 * Python système : c'est le fichier EXACT que l'on envoie à Pyodide, et il
 * n'utilise que la bibliothèque standard. Le navigateur n'apporte que le moteur.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { getPooContent } from '@/lib/espace/catalog';

const RUNNER = path.join(process.cwd(), 'content/espace/nsi-poo/runner.py');
const hasPython = spawnSync('python3', ['--version']).status === 0;
const suite = hasPython ? describe : describe.skip;

interface Result {
  ok: boolean;
  error: string | null;
  output: string;
  tests: { label: string; pass: boolean; message: string }[];
}

function run(code: string, step: string, mode: 'run' | 'test' = 'test'): Result {
  const script = `
import json, sys
exec(open(${JSON.stringify(RUNNER)}, encoding='utf8').read())
data = json.loads(sys.stdin.read())
print(json.dumps(run_submission(data['code'], data['step'], data['mode'])))
`;
  const out = spawnSync('python3', ['-c', script], { input: JSON.stringify({ code, step, mode }), encoding: 'utf8', timeout: 15_000 });
  if (out.status !== 0) throw new Error(`python3 a échoué : ${out.stderr.slice(0, 400)}`);
  return JSON.parse(out.stdout) as Result;
}

const starter = (id: string) => getPooContent().steps.find((s) => s.id === id)!.starter ?? '';

const LIVRE = `class Livre:
    def __init__(self, titre, auteur):
        self.titre = titre
        self.auteur = auteur
        self.disponible = True

    def description(self):
        return self.titre + " / " + self.auteur

    def est_disponible(self):
        return self.disponible

    def emprunter(self):
        if not self.disponible:
            return False
        self.disponible = False
        return True

    def rendre(self):
        if self.disponible:
            return False
        self.disponible = True
        return True
`;

const SOLUTIONS: Record<string, string> = {
  reperes: starter('reperes'),
  instances: `${LIVRE}\nlivre1 = Livre("Dune", "Frank Herbert")\nlivre2 = Livre("1984", "George Orwell")\n`,
  consulter: LIVRE,
  agir: LIVRE,
  references: starter('references'),
  mission: `class Salle:
    def __init__(self, nom, capacite):
        self.nom = nom
        self.capacite = capacite
        self.libres = capacite

    def places_disponibles(self):
        return self.libres

    def reserver(self, n):
        if 0 < n <= self.libres:
            self.libres -= n
            return True
        return False

    def liberer(self, n):
        if 0 < n <= self.capacite - self.libres:
            self.libres += n
            return True
        return False
`,
  bonus: `class Carnet:
    def __init__(self, nom):
        self.nom = nom
        self.notes = []

    def ajouter(self, texte):
        self.notes.append(texte)
`,
};

describe('empreinte du harnais', () => {
  it('est identique au harnais du TP historique archivé', () => {
    const sha = createHash('sha256').update(readFileSync(RUNNER)).digest('hex');
    expect(sha).toBe('7024e30c953224c2dc76089a88e48e31d9a38fd17e8cdc3bc2533b70fbff4c9c');
  });
});

suite('contrôles formatifs (Python système)', () => {
  it.each(Object.keys(SOLUTIONS))('une solution correcte de « %s » passe tous les contrôles', (step) => {
    const result = run(SOLUTIONS[step], step);
    expect(result.error).toBeNull();
    expect(result.tests.length).toBeGreaterThan(0);
    expect(result.tests.filter((t) => !t.pass).map((t) => `${t.label}: ${t.message}`)).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it.each(['instances', 'consulter', 'agir', 'mission', 'bonus'])('le code de départ incomplet de « %s » ne passe pas', (step) => {
    const result = run(starter(step), step);
    expect(result.ok).toBe(false);
  });

  it('un test qui échoue dit pourquoi, en français, sans trace Python brute', () => {
    const buggy = SOLUTIONS.agir.replace('self.disponible = False\n        return True', 'return True');
    const result = run(buggy, 'agir');
    const failing = result.tests.find((t) => !t.pass);
    expect(failing).toBeDefined();
    expect(failing!.message).toMatch(/disponible|False|True/);
    expect(failing!.message).not.toMatch(/Traceback/);
  });

  it('« Exécuter » (mode run) affiche la sortie sans lancer de contrôles', () => {
    const result = run('print("bonjour")', 'reperes', 'run');
    expect(result.output.trim()).toBe('bonjour');
    expect(result.tests).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it.each([
    ['import', 'import os\n'],
    ['open', 'open("/etc/passwd")\n'],
    ['eval', 'eval("1+1")\n'],
    ['introspection', 'x = (1).__class__\n'],
    ['input', 'x = input()\n'],
  ])('refuse « %s » avant toute exécution', (_name, code) => {
    const result = run(code, 'reperes', 'run');
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.output).toBe('');
  });

  it('une erreur de syntaxe est localisée', () => {
    const result = run('class Livre:\n  def x(:\n', 'reperes', 'run');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/SyntaxError.*ligne 2/);
  });

  it('borne la sortie à 6000 caractères', () => {
    const result = run('print("x" * 100000)\n', 'reperes', 'run');
    expect(result.output.length).toBeLessThanOrEqual(6000);
  });

  it('un code de plus de 20 000 caractères est refusé', () => {
    const result = run(`x = 1\n${'#'.repeat(20_001)}`, 'reperes', 'run');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/20 000/);
  });
});
