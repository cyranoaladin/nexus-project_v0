/**
 * @jest-environment node
 *
 * Harnais Python du parcours « Récursivité » (content/espace/nsi-recursivite/runner.py), exécuté avec le
 * Python système : c'est le fichier EXACT envoyé à Pyodide. Les solutions de référence viennent de
 * solutions.py (source unique avec le corrigé) ; on vérifie que D'AUTRES implémentations valides passent
 * (comportement, pas texte), que des codes volontairement faux échouent avec un message pédagogique, et
 * que la non-terminaison est bornée.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'content/espace/nsi-recursivite');
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

function pyDict(name: 'STARTERS' | 'SOLUTIONS' | 'ALTERNATIVES'): Record<string, string> {
  const out = spawnSync(
    'python3',
    ['-c', `import json, sys; sys.dont_write_bytecode = True; sys.path.insert(0, ${JSON.stringify(DIR)}); import solutions; print(json.dumps(solutions.${name}))`],
    { encoding: 'utf8' },
  );
  if (out.status !== 0) throw new Error(out.stderr.slice(0, 400));
  return JSON.parse(out.stdout) as Record<string, string>;
}

const STEPS = ['decouverte', 'pile-appels', 'ecrire', 'structures', 'iteratif', 'mission', 'bonus'] as const;

suite('Récursivité — contrôles formatifs (Python système)', () => {
  const SOLUTIONS = hasPython ? pyDict('SOLUTIONS') : {};
  const STARTERS = hasPython ? pyDict('STARTERS') : {};
  const ALTERNATIVES = hasPython ? pyDict('ALTERNATIVES') : {};
  const failing = (step: string, code: string) => run(code, step).tests.filter((t) => !t.pass);
  const labelsOf = (step: string, code: string) => failing(step, code).map((t) => t.label);

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

  it.each(Object.keys(ALTERNATIVES))('une AUTRE implémentation valide de « %s » passe aussi', (step) => {
    const result = run(ALTERNATIVES[step], step);
    expect(result.tests.filter((t) => !t.pass).map((t) => `${t.label}: ${t.message}`)).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('les programmes de démonstration des solutions s’exécutent (mode run) et affichent les valeurs annoncées', () => {
    expect(run(SOLUTIONS.decouverte, 'decouverte', 'run').output.trim().split('\n')).toEqual(['3', '2', '1', '0']);
    expect(run(SOLUTIONS['pile-appels'], 'pile-appels', 'run').output.trim().split('\n')).toHaveLength(8);
    expect(run(SOLUTIONS.ecrire, 'ecrire', 'run').output.trim().split('\n')).toEqual(['10', '120', '16']);
    expect(run(SOLUTIONS.structures, 'structures', 'run').output.trim().split('\n')).toEqual(['3', 'True', '13']);
    expect(run(SOLUTIONS.iteratif, 'iteratif', 'run').output.trim().split('\n')).toEqual(['1024', '1024']);
    expect(run(SOLUTIONS.mission, 'mission', 'run').output.trim().split('\n')).toEqual(['6', '4', 'ISN']);
    expect(run(SOLUTIONS.bonus, 'bonus', 'run').output.trim().split('\n')).toEqual(['9', '3']);
  });

  describe('terminaison : une récursion sans arrêt est bornée et expliquée', () => {
    it('le programme défectueux du code de départ donne une RecursionError lisible, vite, sans geler', () => {
      const r = run(STARTERS.decouverte, 'decouverte', 'run');
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/^RecursionError, ligne \d+/);
      expect(r.error).toMatch(/cas de base/);
      expect(r.error).toMatch(/n’exécute pas une infinité d’appels/);
      expect(r.output.length).toBeLessThanOrEqual(6000);
      expect(JSON.stringify(r)).not.toMatch(/Traceback/);
    });

    it('en mode test, la même erreur est signalée (pas de test lancé sur du code qui ne termine pas)', () => {
      const r = run(STARTERS.decouverte, 'decouverte', 'test');
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/RecursionError/);
    });

    it.each([
      ['sans cas de base', 'def f(n):\n    return f(n - 1)\nf(3)\n'],
      ['sans progression', 'def f(n):\n    if n == 0:\n        return 0\n    return f(n)\nf(3)\n'],
      ['dans le mauvais sens', 'def f(n):\n    if n == 0:\n        return 0\n    return f(n + 1)\nf(3)\n'],
    ])('récursion « %s » : RecursionError, jamais de blocage', (_n, code) => {
      const r = run(code, 'ecrire', 'run');
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/RecursionError/);
    });

    it('un contrôle qui déclenche la non-terminaison échoue avec un message sur le cas de base, sans interrompre les autres', () => {
      const bad = SOLUTIONS.ecrire.replace('return a * puissance(a, n - 1)', 'return a * puissance(a, n)');
      const r = run(bad, 'ecrire');
      const puis = r.tests.filter((t) => t.label.startsWith('puissance : 2 puissance'));
      expect(puis[0].pass).toBe(false);
      expect(puis[0].message).toMatch(/RecursionError/);
      expect(r.tests.filter((t) => t.label.startsWith('somme') && t.pass).length).toBe(3);
    });
  });

  describe('codes faux : le contrôle précis échoue, avec un message utile', () => {
    it('somme sans return devant l’appel récursif', () => {
      const bad = SOLUTIONS.ecrire.replace('return n + somme(n - 1)', 'n + somme(n - 1)');
      const f = failing('ecrire', bad);
      expect(f.map((t) => t.label)).toContain('somme : somme(1), somme(3), somme(5), somme(10)');
      expect(f.map((t) => t.message).join(' ')).toMatch(/None/);
    });

    it('somme avec print au lieu de return', () => {
      const bad = SOLUTIONS.ecrire.replace('return n + somme(n - 1)', 'print(n + somme(n - 1))');
      expect(failing('ecrire', bad).map((t) => t.message).join(' ')).toMatch(/return/);
    });

    it('somme écrite avec une boucle : valeurs justes mais non récursive', () => {
      const bad = SOLUTIONS.ecrire.replace('    if n == 0:\n        return 0\n    return n + somme(n - 1)', '    total = 0\n    for k in range(n + 1):\n        total += k\n    return total');
      expect(bad).not.toBe(SOLUTIONS.ecrire);
      const labels = labelsOf('ecrire', bad);
      expect(labels).toEqual(['somme : la fonction s’appelle elle-même']);
      expect(failing('ecrire', bad)[0].message).toMatch(/RÉCURSIVE/);
    });

    it('factorielle(0) = 0 (convention oubliée)', () => {
      const bad = SOLUTIONS.ecrire.replace('    if n == 0:\n        return 1\n    return n * factorielle', '    if n == 0:\n        return 0\n    return n * factorielle');
      expect(bad).not.toBe(SOLUTIONS.ecrire);
      expect(labelsOf('ecrire', bad)).toContain('factorielle : 0! = 1 et 1! = 1');
    });

    it('est_palindrome écrite sans récursion (texte == texte[::-1])', () => {
      const bad = SOLUTIONS.structures.replace(/def est_palindrome[\s\S]*?\n\n\n/, 'def est_palindrome(texte):\n    return texte == texte[::-1]\n\n\n');
      expect(labelsOf('structures', bad)).toEqual(['est_palindrome : la fonction s’appelle elle-même']);
    });

    it('est_palindrome qui oublie de comparer l’intérieur', () => {
      const bad = SOLUTIONS.structures.replace('return est_palindrome(texte[1:-1])', 'return True');
      expect(labelsOf('structures', bad)).toContain('est_palindrome : les autres mots renvoient False');
    });

    it('est_palindrome qui renvoie une valeur « truthy » plutôt que True', () => {
      const bad = SOLUTIONS.structures.replace('    if len(texte) <= 1:\n        return True', '    if len(texte) <= 1:\n        return 1');
      expect(bad).not.toBe(SOLUTIONS.structures);
      expect(labelsOf('structures', bad)).toContain('est_palindrome : les palindromes renvoient True');
    });

    it('somme_liste qui modifie la liste reçue (pop)', () => {
      const bad = SOLUTIONS.structures.replace(/def somme_liste[\s\S]*?\n\n\n/, 'def somme_liste(tab):\n    if tab == []:\n        return 0\n    return tab.pop() + somme_liste(tab)\n\n\n');
      const f = failing('structures', bad);
      expect(f.map((t) => t.label)).toContain('somme_liste : la liste reçue n’est pas modifiée');
      expect(f.find((t) => t.label.includes('modifiée'))!.message).toMatch(/modifié la liste/);
    });

    it('compter_fichiers qui oublie les sous-dossiers', () => {
      const bad = SOLUTIONS.mission.replace(/def compter_fichiers[\s\S]*?\n\n\n/, 'def compter_fichiers(element):\n    return len(element)\n\n\n');
      expect(labelsOf('mission', bad)).toEqual(expect.arrayContaining(['compter_fichiers : le dossier de l’énoncé contient 4 fichiers', 'compter_fichiers : la fonction s’appelle elle-même']));
    });

    it('compter_fichiers qui parcourt un fichier comme un dossier (isinstance oublié)', () => {
      const bad = SOLUTIONS.mission.replace(/def compter_fichiers[\s\S]*?\n\n\n/, 'def compter_fichiers(element):\n    total = 0\n    for y in element:\n        total = total + compter_fichiers(y)\n    return total\n\n\n');
      expect(labelsOf('mission', bad).length).toBeGreaterThan(0);
    });

    it('inverse qui ne change rien (mauvais ordre)', () => {
      const bad = SOLUTIONS.mission.replace('return inverse(texte[1:]) + texte[0]', 'return texte[0] + inverse(texte[1:])');
      expect(labelsOf('mission', bad)).toContain('inverse : cas de base et valeurs');
    });

    it('puissance_iterative qui délègue à la version récursive', () => {
      const bad = SOLUTIONS.iteratif.replace(/    resultat = 1\n    for _ in range\(n\):\n        resultat = resultat \* a\n    return resultat/, '    return puissance_recursive(a, n)');
      expect(bad).not.toBe(SOLUTIONS.iteratif);
      const f = failing('iteratif', bad);
      expect(f.map((t) => t.label)).toContain('La version itérative n’utilise aucun appel récursif');
      expect(f.map((t) => t.label)).toContain('Sans pile d’appels : puissance_iterative(2, 1000) fonctionne');
    });

    it('somme_trace sans retrait ni ordre APPEL/RETOUR correct', () => {
      const bad = SOLUTIONS['pile-appels'].replace('resultat = n + somme_trace(n - 1, profondeur + 1)', 'resultat = n + somme_trace(n - 1, profondeur)');
      const f = failing('pile-appels', bad);
      expect(f.map((t) => t.label)).toContain('Les APPEL et RETOUR de somme_trace(3), avec leur retrait');
      expect(f[0].message).toMatch(/Ligne \d+ de l’affichage/);
    });

    it('dichotomie linéaire (un appel par case) refusée pour inefficacité', () => {
      const bad = SOLUTIONS.bonus.replace(/def indice_dicho[\s\S]*?\n\n\n/, 'def indice_dicho(tab, x, debut, fin):\n    if debut > fin:\n        return -1\n    if tab[debut] == x:\n        return debut\n    return indice_dicho(tab, x, debut + 1, fin)\n\n\n');
      const f = failing('bonus', bad);
      expect(f.map((t) => t.label)).toContain('indice_dicho : environ la moitié des cases écartée à chaque appel');
    });

    it('une erreur d’exécution dans le code élève est expliquée sans trace Python brute', () => {
      const r = run('def f(n):\n    return n + "a"\nf(1)\n', 'ecrire', 'run');
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/TypeError, ligne 2/);
      expect(JSON.stringify(r)).not.toMatch(/Traceback/);
    });

    it('un nom de fonction manquant est signalé clairement', () => {
      const r = run('def autre(n):\n    return n\n', 'ecrire');
      expect(r.tests[0].pass).toBe(false);
      expect(r.tests[0].message).toMatch(/Définis une fonction nommée somme/);
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
      ['import sys', 'import sys\nsys.setrecursionlimit(10**6)\n'],
      ['from … import', 'from collections import deque\n'],
    ])('refuse « %s » avant toute exécution', (_n, code) => {
      const result = run(code, 'ecrire', 'run');
      expect(result.ok).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.output).toBe('');
    });

    it('l’élève ne peut pas relever la limite de récursion', () => {
      const r = run('def f(n):\n    return f(n - 1)\nf(1)\n', 'ecrire', 'run');
      expect(r.error).toMatch(/limite de cet atelier : 200/);
    });

    it('une erreur de syntaxe est localisée', () => {
      const r = run('def somme(n:\n    pass\n', 'ecrire', 'run');
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/SyntaxError.*ligne 1/);
    });

    it('borne la sortie et la taille du code', () => {
      expect(run('print("x" * 100000)\n', 'ecrire', 'run').output.length).toBeLessThanOrEqual(6000);
      const big = run(`x = 1\n${'#'.repeat(20_001)}`, 'ecrire', 'run');
      expect(big.ok).toBe(false);
      expect(big.error).toMatch(/20 000/);
    });

    it('une étape sans test de code le dit', () => {
      const r = run('x = 1\n', 'synthese', 'test');
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/sans test/);
    });
  });
});
