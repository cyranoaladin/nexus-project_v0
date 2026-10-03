/**
 * @jest-environment node
 *
 * Harnais Python du TP POO 2 (content/espace/nsi-structures-lineaires/runner.py), exécuté avec
 * le Python système : c'est le fichier EXACT envoyé à Pyodide. Les solutions de référence
 * viennent de solutions.py (source unique avec le corrigé) ; on vérifie aussi que d'AUTRES
 * implémentations valides passent (les contrôles portent sur le comportement, pas sur le code)
 * et que des codes volontairement faux échouent avec un message pédagogique.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'content/espace/nsi-structures-lineaires');
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
exec(open(${JSON.stringify(path.join(DIR, 'runner.py'))}, encoding='utf8').read())
data = json.loads(sys.stdin.read())
print(json.dumps(run_submission(data['code'], data['step'], data['mode'])))
`;
  const out = spawnSync('python3', ['-c', script], { input: JSON.stringify({ code, step, mode }), encoding: 'utf8', timeout: 20_000 });
  if (out.status !== 0) throw new Error(`python3 a échoué : ${out.stderr.slice(0, 400)}`);
  return JSON.parse(out.stdout) as Result;
}

/** Charge solutions.py et renvoie un des dictionnaires (STARTERS, SOLUTIONS, ALTERNATIVES). */
function pyDict(name: 'STARTERS' | 'SOLUTIONS' | 'ALTERNATIVES'): Record<string, string> {
  const out = spawnSync(
    'python3',
    ['-c', `import json, sys; sys.dont_write_bytecode = True; sys.path.insert(0, ${JSON.stringify(DIR)}); import solutions; print(json.dumps(solutions.${name}))`],
    { encoding: 'utf8' },
  );
  if (out.status !== 0) throw new Error(out.stderr.slice(0, 400));
  return JSON.parse(out.stdout) as Record<string, string>;
}

const STEPS = ['liste', 'pile', 'file', 'mission', 'bonus'] as const;

suite('TP POO 2 — contrôles formatifs (Python système)', () => {
  const SOLUTIONS = hasPython ? pyDict('SOLUTIONS') : {};
  const STARTERS = hasPython ? pyDict('STARTERS') : {};
  const ALTERNATIVES = hasPython ? pyDict('ALTERNATIVES') : {};

  it.each(STEPS)('la solution de référence de « %s » passe tous les contrôles', (step) => {
    const result = run(SOLUTIONS[step], step);
    expect(result.error).toBeNull();
    expect(result.tests.length).toBeGreaterThan(0);
    expect(result.tests.filter((t) => !t.pass).map((t) => `${t.label}: ${t.message}`)).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it.each(STEPS)('le code de départ de « %s » ne passe aucun contrôle par hasard', (step) => {
    const result = run(STARTERS[step], step);
    expect(result.ok).toBe(false);
    expect(result.tests.filter((t) => t.pass)).toEqual([]);
  });

  it.each(Object.keys(ALTERNATIVES))('une AUTRE implémentation valide de « %s » (représentation inversée) passe aussi', (step) => {
    const result = run(ALTERNATIVES[step], step);
    expect(result.tests.filter((t) => !t.pass).map((t) => `${t.label}: ${t.message}`)).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('les programmes de démonstration du code de départ s’exécutent (mode run) et affichent les valeurs annoncées', () => {
    expect(run(SOLUTIONS.liste, 'liste', 'run').output.trim().split('\n')).toEqual(['2', 'Alan']);
    expect(run(SOLUTIONS.pile, 'pile', 'run').output.trim().split('\n')).toEqual(['C', 'B', '2']);
    expect(run(SOLUTIONS.file, 'file', 'run').output.trim().split('\n')).toEqual(['Adam', 'Alexandre', '2']);
    expect(run(SOLUTIONS.mission, 'mission', 'run').output.trim().split('\n')).toEqual(['DS_Maths.pdf', 'DS_Maths.pdf', '2', 'noir', '3']);
    expect(run(SOLUTIONS.bonus, 'bonus', 'run').output.trim().split('\n')).toEqual(['A', '1']);
  });

  describe('codes faux : le contrôle précis échoue, avec un message utile', () => {
    const failing = (step: string, code: string) => run(code, step).tests.filter((t) => !t.pass);

    it('Pile.depiler qui ne retire pas', () => {
      const bad = SOLUTIONS.pile.replace('return self._elements.pop()', 'return self._elements[-1]');
      const f = failing('pile', bad);
      expect(f.map((t) => t.label)).toContain('depiler : renvoie ET retire');
      expect(f[0].message).not.toMatch(/Traceback/);
    });

    it('Pile qui se comporte comme une file (FIFO)', () => {
      const bad = SOLUTIONS.pile.replace('return self._elements.pop()', 'return self._elements.pop(0)').replace('return self._elements[-1]', 'return self._elements[0]');
      expect(failing('pile', bad).map((t) => t.label)).toContain('LIFO : dernier entré, premier sorti');
    });

    it('Pile.depiler qui renvoie None sur pile vide au lieu de lever IndexError', () => {
      const bad = SOLUTIONS.pile.replace(/def depiler\(self\):\n        if self.est_vide\(\):\n            raise IndexError\("pile vide"\)/, 'def depiler(self):\n        if self.est_vide():\n            return None');
      expect(bad).not.toBe(SOLUTIONS.pile);
      expect(failing('pile', bad).map((t) => t.label)).toContain('Pile vide : sommet et depiler lèvent IndexError');
    });

    it('Pile dont tous les objets partagent la même list (attribut de classe)', () => {
      const bad = SOLUTIONS.pile.replace('class Pile:\n    def __init__(self):\n        self._elements = []', 'class Pile:\n    _partage = []\n    def __init__(self):\n        self._elements = Pile._partage');
      expect(bad).not.toBe(SOLUTIONS.pile);
      expect(failing('pile', bad).map((t) => t.label)).toContain('Plusieurs piles indépendantes');
    });

    it('File.defiler qui retire le dernier arrivé', () => {
      const bad = SOLUTIONS.file.replace('return self._elements.pop(0)', 'return self._elements.pop()');
      expect(failing('file', bad).map((t) => t.label)).toContain('FIFO : premier entré, premier sorti');
    });

    it('Liste.element qui accepte un indice négatif (comme list[-1])', () => {
      const bad = SOLUTIONS.liste.replace('if indice < 0 or indice >= len(self._elements):', 'if indice >= len(self._elements):');
      const f = failing('liste', bad);
      expect(f.map((t) => t.label)).toContain('element : indice invalide → IndexError');
      expect(f.map((t) => t.message).join(' ')).toMatch(/négatif/);
    });

    it('Liste.element qui renvoie None au lieu de lever IndexError', () => {
      const bad = SOLUTIONS.liste.replace('raise IndexError("indice invalide")', 'return None');
      expect(failing('liste', bad).map((t) => t.label)).toContain('element : indice invalide → IndexError');
    });

    it('Reglages.annuler qui ne restaure rien', () => {
      const bad = SOLUTIONS.mission.replace('nom, ancienne = self._historique.depiler()\n        self._valeurs[nom] = ancienne', 'self._historique.depiler()');
      expect(bad).not.toBe(SOLUTIONS.mission);
      expect(failing('mission', bad).map((t) => t.label)).toContain('Réglages : annuler restaure la valeur précédente');
    });

    it('une erreur d’exécution dans le code élève est expliquée sans trace Python brute', () => {
      const own = SOLUTIONS.mission.replace('self._attente = File()', 'self._attente = []');
      expect(own).not.toBe(SOLUTIONS.mission);
      const r = run(own, 'mission');
      expect(r.ok).toBe(false);
      expect(r.error ?? r.tests.map((t) => t.message).join(' ')).toMatch(/enfiler|AttributeError/);
      expect(JSON.stringify(r)).not.toMatch(/Traceback/);
    });

    it('FileDeque sans deque correct : popleft attendu — un défilement LIFO est refusé', () => {
      const bad = SOLUTIONS.bonus.replace('self._elements.popleft()', 'self._elements.pop()');
      expect(failing('bonus', bad).map((t) => t.label)).toContain('FileDeque : FIFO');
    });
  });

  describe('restrictions pédagogiques', () => {
    it.each([
      ['open', 'open("/etc/passwd")\n'],
      ['eval', 'eval("1+1")\n'],
      ['exec', 'exec("x=1")\n'],
      ['introspection', 'x = (1).__class__\n'],
      ['input', 'x = input()\n'],
      ['import os', 'import os\n'],
      ['import hors étape', 'from collections import deque\n'],
    ])('refuse « %s » avant toute exécution (étape liste)', (_n, code) => {
      const result = run(code, 'liste', 'run');
      expect(result.ok).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.output).toBe('');
    });

    it('autorise collections.deque à l’étape bonus uniquement', () => {
      const r = run('from collections import deque\nd = deque()\nd.append(1)\nprint(len(d))\n', 'bonus', 'run');
      expect(r.error).toBeNull();
      expect(r.output.trim()).toBe('1');
      expect(run('import os\n', 'bonus', 'run').ok).toBe(false);
      expect(run('import sys\n', 'bonus', 'run').ok).toBe(false);
    });

    it('autorise __init__ mais explique le tiret bas unique pour les autres noms à double tiret', () => {
      expect(run('class A:\n    def __init__(self):\n        self.x = 1\n', 'liste', 'run').error).toBeNull();
      const bad = run('class A:\n    def __init__(self):\n        self.__x = 1\n', 'liste', 'run');
      expect(bad.ok).toBe(false);
      expect(bad.error).toMatch(/tiret bas/i);
    });

    it('une erreur de syntaxe est localisée', () => {
      const r = run('class Pile:\n  def x(:\n', 'pile', 'run');
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/SyntaxError.*ligne 2/);
    });

    it('borne la sortie et la taille du code', () => {
      expect(run('print("x" * 100000)\n', 'liste', 'run').output.length).toBeLessThanOrEqual(6000);
      const big = run(`x = 1\n${'#'.repeat(20_001)}`, 'liste', 'run');
      expect(big.ok).toBe(false);
      expect(big.error).toMatch(/20 000/);
    });

    it('une boucle infinie ne bloque pas le harnais de test sous CPython (le Worker applique le délai côté navigateur)', () => {
      // On ne lance PAS de boucle infinie ici : on vérifie seulement qu'une longue boucle finie est bien exécutée.
      const r = run('s = 0\nfor i in range(200000):\n    s += i\nprint(s)\n', 'liste', 'run');
      expect(r.output.trim()).toBe('19999900000');
    });
  });
});
