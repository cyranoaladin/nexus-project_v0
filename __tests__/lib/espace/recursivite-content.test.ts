/**
 * @jest-environment node
 *
 * Intégrité du contenu du parcours « Récursivité et programmation récursive »
 * (content/espace/nsi-recursivite/content.json) : progression, couverture des capacités du programme,
 * cohérence avec le harnais Python, jetons d'intercalation, pédagogie des questions, typographie française,
 * et — surtout — absence de toute solution côté élève.
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { ACTIVITIES, getActivityDef, getLesson, getLessonRequiredSteps, getLessonSteps } from '@/lib/espace/catalog';
import { lessonHref, POO2_ACTIVITY_SLUG, POO_ACTIVITY_SLUG, RECURSIVITE_ACTIVITY_SLUG } from '@/lib/espace/lesson-routes';
import type { LessonContent, LessonStep } from '@/lib/espace/lesson-types';

const DIR = path.join(process.cwd(), 'content/espace/nsi-recursivite');
const RAW = readFileSync(path.join(DIR, 'content.json'), 'utf8');
const content = JSON.parse(RAW) as LessonContent;
const hasPython = spawnSync('python3', ['--version']).status === 0;

const step = (id: string): LessonStep => content.steps.find((s) => s.id === id)!;

function prose(s: LessonStep): string[] {
  const strip = (h: string) => h.replace(/<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>|<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ');
  return [
    s.title, s.level, strip(s.intro), strip(s.lesson), s.task, s.takeaway, ...s.hints,
    ...s.questions.flatMap((q) => [q.text, ...q.choices, q.feedback, ...(q.choiceFeedback ?? [])]),
    ...s.fields.flatMap((f) => [f.label, f.placeholder ?? '', f.check?.success ?? '', f.check?.fallback ?? '', ...(f.check?.rules?.map((r) => r.feedback) ?? [])]),
  ];
}

const allLesson = content.steps.map((s) => s.lesson).join('\n');

describe('position dans la progression NSI', () => {
  it('est un parcours autonome « Algorithmique et programmation », distinct des TP POO', () => {
    expect(RECURSIVITE_ACTIVITY_SLUG).toBe('nsi-recursivite');
    const def = getActivityDef(RECURSIVITE_ACTIVITY_SLUG)!;
    expect(def.subject).toBe('NSI');
    expect(def.theme).toBe('Algorithmique et programmation');
    expect(def.title).toBe('Récursivité et programmation récursive');
    expect(def.title).not.toMatch(/POO/);
    expect(lessonHref(RECURSIVITE_ACTIVITY_SLUG)).toBe('/espace/nsi/recursivite');
    expect(lessonHref(RECURSIVITE_ACTIVITY_SLUG, 's1')).toBe('/espace/nsi/recursivite?seance=s1');
  });

  it('les deux TP POO restent inchangés et sous le thème « Programmation orientée objet »', () => {
    const poo1 = getActivityDef(POO_ACTIVITY_SLUG)!;
    const poo2 = getActivityDef(POO2_ACTIVITY_SLUG)!;
    expect(poo1.title).toBe('TP POO 1 — Des objets qui agissent');
    expect(poo2.title).toBe('TP POO 2 — Listes, piles et files');
    expect(poo1.theme).toBe('Programmation orientée objet');
    expect(poo2.theme).toBe('Programmation orientée objet');
  });

  it('l’ordre pédagogique du catalogue NSI est POO 1, POO 2, puis Récursivité', () => {
    expect(ACTIVITIES.filter((a) => a.subject === 'NSI' && a.kind === 'PYTHON_TP').map((a) => a.slug)).toEqual([POO_ACTIVITY_SLUG, POO2_ACTIVITY_SLUG, RECURSIVITE_ACTIVITY_SLUG]);
  });

  it('les activités de maths n’ont pas de thème (affichage inchangé)', () => {
    for (const a of ACTIVITIES.filter((x) => x.subject === 'MATHEMATIQUES')) expect(a.theme).toBeUndefined();
  });

  it('expose un corrigé enseignant privé, jamais visible des élèves', () => {
    const def = getActivityDef(RECURSIVITE_ACTIVITY_SLUG)!;
    expect(def.resources).toEqual([expect.objectContaining({ key: 'corrige', audience: 'TEACHER' })]);
  });
});

describe('structure du parcours', () => {
  it('suit la progression attendue (8 étapes, synthèse, bonus)', () => {
    expect(content.steps.map((s) => s.id)).toEqual(['diagnostic', 'decouverte', 'cas-de-base', 'pile-appels', 'ecrire', 'structures', 'iteratif', 'mission', 'synthese', 'bonus']);
  });

  it('dure entre 1 h 50 et 2 h hors bonus, le noyau fait de 110 à 115 min, et le bonus ne compte pas', () => {
    const required = content.steps.filter((s) => s.id !== 'bonus');
    const total = required.reduce((n, s) => n + s.minutes, 0);
    expect(total).toBeGreaterThanOrEqual(110);
    expect(total).toBeLessThanOrEqual(115);
    expect(content.duration).toBe(120);
    expect(step('bonus').minutes).toBe(0);
    expect(step('diagnostic').minutes).toBe(8);
    expect(step('synthese').minutes).toBe(8);
  });

  it('est enregistré au catalogue, bonus facultatif', () => {
    expect(getLesson(RECURSIVITE_ACTIVITY_SLUG)).toBeDefined();
    expect(getLessonSteps(RECURSIVITE_ACTIVITY_SLUG)).toHaveLength(10);
    expect(getLessonRequiredSteps(RECURSIVITE_ACTIVITY_SLUG).map((s) => s.id)).not.toContain('bonus');
    expect(getActivityDef(RECURSIVITE_ACTIVITY_SLUG)!.stepsTotal).toBe(9);
  });

  it('a des identifiants uniques (étapes, questions, champs, figures)', () => {
    expect(new Set(content.steps.map((s) => s.id)).size).toBe(content.steps.length);
    for (const s of content.steps) {
      for (const list of [s.questions.map((q) => q.id), s.fields.map((f) => f.id), (s.figures ?? []).map((f) => f.id)]) {
        expect(new Set(list).size).toBe(list.length);
      }
    }
  });

  it('la fiche de synthèse est imprimable et elle seule', () => {
    expect(content.steps.filter((s) => s.printable).map((s) => s.id)).toEqual(['synthese']);
  });
});

describe('capacités du programme couvertes', () => {
  const lower = (RAW + allLesson).toLowerCase();

  it.each([
    ['principe de récursivité', 'fonction qui s’appelle elle-même'],
    ['cas de base', 'cas de base'],
    ['appel récursif', 'appel récursif'],
    ['appels successifs / pile d’appels', 'pile d’appels'],
    ['condition d’arrêt', 'condition d’arrêt'],
    ['LIFO', 'lifo'],
    ['RecursionError', 'recursionerror'],
    ['terminaison', 'terminaison'],
    ['itératif ou récursif', 'itératif ou récursif'],
    ['récurrence mathématique distincte', 'récurrence'],
    ['dichotomie en bonus', 'dichotomie'],
    ['diviser pour régner', 'diviser pour régner'],
    ['Fibonacci comme contre-exemple', 'correcte mais inefficace'],
  ])('traite : %s', (_n, needle) => {
    expect(lower).toContain(needle);
  });

  it('présente le cas de base et l’appel récursif du compte à rebours', () => {
    expect(step('decouverte').lesson).toContain('if n &lt; 0:');
    expect(step('decouverte').lesson).toContain('compte_a_rebours(n - 1)');
  });

  it('montre le premier bug récursif (compte à rebours sans progression)', () => {
    expect(step('decouverte').starter).toContain('compte_a_rebours(n)');
    expect(step('decouverte').lesson).toMatch(/RecursionError/);
  });

  it('distingue explicitement récurrence mathématique et fonction récursive', () => {
    const l = step('cas-de-base').lesson;
    expect(l).toMatch(/En mathématiques/);
    expect(l).toMatch(/u_\{n\+1\}=f\(u_n\)/);
    expect(l).toMatch(/directement ou indirectement/);
    expect(l).toMatch(/ne sont pas deux notions identiques/);
  });

  it('fait le lien avec le TP Piles : la pile d’appels n’est pas à programmer', () => {
    const l = step('pile-appels').lesson;
    expect(l).toMatch(/mémoriser où elle devra revenir/);
    expect(l).toMatch(/temporairement empilés/);
    expect(l).toMatch(/LIFO/);
    expect(l).toMatch(/Le dernier appel créé est le premier appel terminé/);
    expect(l).toMatch(/n’est pas un objet Python que tu programmes toi-même/);
  });

  it('propose la trace interactive APPEL/RETOUR de somme(4) et de puissance(2, 4)', () => {
    const figs = step('pile-appels').figures!;
    expect(figs.map((f) => f.type)).toEqual(['call-trace', 'call-trace']);
    expect(figs[0]).toMatchObject({ fn: 'somme', args: [4] });
    expect(figs[1]).toMatchObject({ fn: 'puissance', args: [2, 4] });
  });

  it('couvre somme, factorielle (0! = 1 expliquée) et puissance, avec raisonnement avant le code', () => {
    const e = step('ecrire');
    expect(e.starter).toContain('def somme(n)');
    expect(e.starter).toContain('def factorielle(n)');
    expect(e.starter).toContain('def puissance(a, n)');
    expect(e.lesson).toMatch(/0!=1/);
    expect(e.fields.map((f) => f.id)).toEqual(expect.arrayContaining(['cas-de-base', 'reduction', 'terminaison']));
    expect(e.lesson.indexOf('{{f:cas-de-base}}')).toBeLessThan(e.lesson.indexOf('{{code}}'));
  });

  it('traite les cinq erreurs fréquentes', () => {
    expect(step('ecrire').questions.map((q) => q.id)).toEqual(['defaut-sans-base', 'defaut-sans-progression', 'defaut-mauvais-sens']);
    expect(step('cas-de-base').questions.map((q) => q.id)).toEqual(expect.arrayContaining(['oubli-return', 'print-return']));
  });

  it('traite chaînes, palindrome et listes, avec la remarque sur les copies de listes', () => {
    const s = step('structures');
    expect(s.starter).toContain('def longueur(texte)');
    expect(s.starter).toContain('def est_palindrome(texte)');
    expect(s.starter).toContain('def somme_liste(tab)');
    expect(s.lesson).toMatch(/nouvelle<\/em> liste/);
    expect(s.lesson).toMatch(/pas forcément la solution la plus efficace/);
  });

  it('compare itératif et récursif sans prétendre à un vainqueur ni à une optimisation de Python', () => {
    const l = step('iteratif').lesson + JSON.stringify(step('iteratif').questions);
    expect(l).toContain('factorielle_iterative');
    expect(l).toContain('factorielle_recursive');
    expect(l).toMatch(/toujours meilleure/);
    expect(l).toMatch(/ne la «\u00a0transforme\u00a0» pas en boucle/);
    expect(RAW.toLowerCase()).not.toMatch(/récursion terminale|continuation|optimis\w+ la récursi/);
  });

  it('la mission « dossier imaginaire » compte les fichiers imbriqués, avec échauffement accessible et second exercice', () => {
    const m = step('mission');
    expect(m.starter).toContain('def compter_elements(x)');
    expect(m.starter).toContain('def compter_fichiers(element)');
    expect(m.starter).toContain('def inverse(texte)');
    expect(m.starter).toContain('"cours.pdf"');
    expect(m.lesson).toMatch(/\[1, \[2, 3\], \[4, \[5, 6\]\]\]/);
    expect(m.lesson).toMatch(/arbres/);
  });

  it('la synthèse reprend la fiche demandée, la pile d’appels et la carte des chapitres futurs', () => {
    const l = step('synthese').lesson;
    for (const needle of ['Une fonction récursive', 'Elle doit posséder', 'Pourquoi cette fonction finit-elle', 'Que doit retourner l’appel récursif', 'dernier appel créé = premier appel terminé', 'LIFO', 'Diviser pour régner', 'Arbres', 'Parcours en profondeur', 'problèmes d\'optimisation']) {
      expect(l.toLowerCase()).toContain(needle.toLowerCase());
    }
  });

  it('le bonus : dichotomie récursive, Fibonacci comme contre-exemple, arbre fractal en lecture seule — hors du noyau', () => {
    const b = step('bonus');
    expect(b.starter).toContain('def indice_dicho');
    expect(b.starter).toContain('def maximum');
    expect(b.lesson).toMatch(/Fibonacci/);
    expect(b.lesson).toMatch(/diviser pour régner/);
    expect(b.lesson).toMatch(/techniques pour éviter ces recalculs/);
    expect(b.figures!.map((f) => f.id)).toEqual(['trace-fib', 'svg-arbre']);
    // Fibonacci n'est jamais un premier exemple.
    expect(allLesson.replace(b.lesson, '')).not.toMatch(/fibonacci/i);
  });

  it('l’encadré « Comment construire une fonction récursive ? » apparaît plusieurs fois', () => {
    const count = content.steps.filter((s) => /Comment construire une fonction récursive\u202f\?/.test(s.lesson)).map((s) => s.id);
    expect(count.length).toBeGreaterThanOrEqual(4);
    for (const s of content.steps.filter((x) => count.includes(x.id))) {
      for (const needle of ['cas de base', 'appel récursif', 'terminaison', 'valeur retournée']) expect(s.lesson.toLowerCase()).toContain(needle);
    }
  });

  it('les sept compétences suivies existent et visent des étapes réelles', () => {
    expect(content.skills!.map((s) => s.id)).toEqual(['cas-de-base', 'appel-recursif', 'terminaison', 'tracer', 'valeurs-retour', 'ecrire', 'iteratif-recursif']);
    const ids = new Set(content.steps.map((s) => s.id));
    for (const sk of content.skills!) {
      expect(sk.label.length).toBeGreaterThan(8);
      expect(sk.steps.length).toBeGreaterThan(0);
      sk.steps.forEach((id) => expect(ids).toContain(id));
    }
  });
});

describe('aides progressives', () => {
  it.each(['decouverte', 'pile-appels', 'ecrire', 'structures', 'iteratif', 'mission', 'bonus'])('« %s » : trois aides — cas de base, réduction, squelette', (id) => {
    const hints = step(id).hints;
    expect(hints).toHaveLength(3);
    expect(hints[0].toLowerCase()).toMatch(/cas de base|rappel/);
    expect(hints[1].toLowerCase()).toMatch(/réduction|problème plus petit|ramèn|ramen|mêmes|moitié|retire|développement/);
    expect(hints[2].toLowerCase()).toMatch(/squelette/);
  });

  it('aucune aide ne contient un bloc de code complet ni la solution', () => {
    for (const s of content.steps) s.hints.forEach((h) => expect(h).not.toMatch(/<pre|```|def |\\n|return /));
  });
});

describe('intercalation explication / essai', () => {
  it.each(content.steps.map((s) => s.id))('« %s » : chaque jeton désigne un élément existant et chaque élément est placé (sauf la synthèse, dont les questions suivent la fiche)', (id) => {
    const s = step(id);
    const tokens = [...s.lesson.matchAll(/\{\{(q|f|fig):([\w-]+)\}\}|\{\{code\}\}/g)];
    const q = new Set(s.questions.map((x) => x.id));
    const f = new Set(s.fields.map((x) => x.id));
    const fig = new Set((s.figures ?? []).map((x) => x.id));
    for (const t of tokens) {
      if (t[1] === 'q') expect(q).toContain(t[2]);
      if (t[1] === 'f') expect(f).toContain(t[2]);
      if (t[1] === 'fig') expect(fig).toContain(t[2]);
    }
    if (id !== 'synthese') {
      for (const x of q) expect(s.lesson).toContain(`{{q:${x}}}`);
      for (const x of f) expect(s.lesson).toContain(`{{f:${x}}}`);
    }
    for (const x of fig) expect(s.lesson).toContain(`{{fig:${x}}}`);
    expect(/\{\{code\}\}/.test(s.lesson)).toBe(s.starter !== null);
  });
});

describe('questions à choix', () => {
  const all = content.steps.flatMap((s) => s.questions.map((q) => ({ step: s.id, q })));

  it.each(all.map((x) => [`${x.step}/${x.q.id}`, x.q] as const))('%s : bonne réponse valide et un retour ciblé par choix', (_n, q) => {
    expect(q.choices.length).toBeGreaterThanOrEqual(2);
    expect(q.correct).toBeGreaterThanOrEqual(0);
    expect(q.correct).toBeLessThan(q.choices.length);
    expect(q.choiceFeedback).toHaveLength(q.choices.length);
    expect(new Set(q.choices).size).toBe(q.choices.length);
    q.choiceFeedback!.forEach((m, i) => expect(m.length).toBeGreaterThan(i === q.correct ? 3 : 15));
    q.choiceFeedback!.forEach((m) => expect(m.trim().toLowerCase()).not.toMatch(/^(faux|non|mauvaise réponse)\.?$/));
    expect(q.feedback.length).toBeGreaterThan(20);
  });

  it('les bonnes réponses ne sont pas toujours à la même place', () => {
    const counts = [0, 1, 2, 3].map((i) => all.filter((x) => x.q.correct === i).length);
    expect(counts.filter((n) => n > 0).length).toBeGreaterThanOrEqual(4);
    for (const n of counts) expect(n / all.length).toBeLessThan(0.45);
  });
});

describe('champs de réponse', () => {
  it('les champs vérifiables acceptent la bonne valeur et corrigent la confusion la plus probable', () => {
    const v1 = step('cas-de-base').fields.find((f) => f.id === 'valeur-1')!.check!;
    const v4 = step('cas-de-base').fields.find((f) => f.id === 'valeur-4')!.check!;
    const z = step('ecrire').fields.find((f) => f.id === 'zero-fact')!.check!;
    expect(v1.accept).toEqual(['1']);
    expect(v4.accept).toEqual(['10']);
    expect(z.accept).toEqual(['1']);
    expect(z.rules![0].feedback).toMatch(/0! = 1/);
    expect(v4.rules![0].feedback).toMatch(/somme\(3\)/);
  });
});

describe('cohérence avec le harnais Python', () => {
  const suite = hasPython ? it : it.skip;
  const solutions = () => {
    const out = spawnSync('python3', ['-c', `import json,sys; sys.dont_write_bytecode = True; sys.path.insert(0, ${JSON.stringify(DIR)}); import solutions; print(json.dumps(solutions.SOLUTIONS))`], { encoding: 'utf8' });
    return JSON.parse(out.stdout) as Record<string, string>;
  };

  suite.each(['decouverte', 'pile-appels', 'ecrire', 'structures', 'iteratif', 'mission', 'bonus'])('« %s » : les intitulés de contrôle du contenu sont exactement ceux du harnais', (id) => {
    const script = `
import json, sys
exec(open(${JSON.stringify(path.join(DIR, 'runner.py'))}, encoding='utf8').read())
d = json.loads(sys.stdin.read())
print(json.dumps([t['label'] for t in run_submission(d['code'], d['step'], 'test')['tests']]))
`;
    const out = spawnSync('python3', ['-c', script], { input: JSON.stringify({ code: solutions()[id], step: id }), encoding: 'utf8' });
    expect(step(id).tests).toEqual(JSON.parse(out.stdout) as string[]);
  });

  suite('les codes de départ du contenu sont ceux de solutions.py', () => {
    const out = spawnSync('python3', ['-c', `import json,sys; sys.dont_write_bytecode = True; sys.path.insert(0, ${JSON.stringify(DIR)}); import solutions; print(json.dumps(solutions.STARTERS))`], { encoding: 'utf8' });
    const starters = JSON.parse(out.stdout) as Record<string, string>;
    for (const [id, code] of Object.entries(starters)) expect(step(id).starter).toBe(code);
  });

  it('les étapes sans éditeur n’ont ni code de départ ni contrôle', () => {
    for (const id of ['diagnostic', 'cas-de-base', 'synthese']) {
      expect(step(id).starter).toBeNull();
      expect(step(id).tests).toEqual([]);
    }
  });

  it('chaque exercice a des tests comportementaux (valeurs de retour), pas seulement la présence de mots', () => {
    const source = readFileSync(path.join(DIR, 'runner.py'), 'utf8');
    expect(source).toMatch(/expect\(got == want/);
    expect(source).not.toMatch(/\bin code\b|re\.search\(.*code/);
  });
});

describe('aucune solution côté élève', () => {
  it('hors indices, content.json ne contient aucun corps de fonction de référence', () => {
    // Les solutions ne figurent que dans solutions.py et le corrigé enseignant. Les exemples de COURS (somme, compte à
    // rebours, factorielle et puissance de l'étape 1, 2, 3 et 6) sont montrés et ne sont pas les exercices demandés.
    const withoutStarters = JSON.stringify(content.steps.map((s) => ({ ...s, hints: [], starter: null, lesson: s.id === 'bonus' ? '' : s.lesson })));
    for (const frag of [
      'return a * puissance(a, n - 1)\\n\\n\\ndef',
      'return 1 + longueur(texte[1:])',
      'return est_palindrome(texte[1:-1])',
      'return tab[0] + somme_liste(tab[1:])',
      'inverse(texte[1:]) + texte[0]',
      'return indice_dicho(tab, x, milieu + 1, fin)',
      'resultat = n + somme_trace(n - 1, profondeur + 1)',
      'total = total + compter_fichiers(sous_element)',
    ]) {
      expect(withoutStarters).not.toContain(frag);
    }
    expect(step('bonus').lesson).not.toContain('milieu + 1');
  });

  it('les codes de départ ne résolvent rien : toutes les fonctions à écrire sont des « pass » ou à compléter', () => {
    expect((step('ecrire').starter!.match(/^\s+pass$/gm) ?? []).length).toBe(3);
    expect((step('structures').starter!.match(/^\s+pass$/gm) ?? []).length).toBe(3);
    expect((step('mission').starter!.match(/^\s+pass$/gm) ?? []).length).toBe(3);
    expect((step('bonus').starter!.match(/^\s+pass$/gm) ?? []).length).toBe(2);
    expect(step('pile-appels').starter).toContain('resultat = None');
    expect(step('pile-appels').starter).not.toContain('somme_trace(n - 1');
  });

  it('le code de départ de la découverte est le programme défectueux, pas sa réparation', () => {
    expect(step('decouverte').starter).not.toContain('if n < 0');
  });
});

describe('typographie française', () => {
  const all = content.steps.flatMap((s) => prose(s).map((t) => ({ step: s.id, t })));

  it('aucune espace ordinaire avant ? ! ; : (hors code)', () => {
    const bad = all.filter(({ t }) => /[^\s] [?!;:]/.test(t)).map((x) => `${x.step}: ${x.t.slice(0, 60)}`);
    expect(bad).toEqual([]);
  });

  it('les guillemets français sont suivis/précédés d’une espace insécable', () => {
    const bad = all.filter(({ t }) => /«(?!\u00a0)|(?<!\u00a0)»/.test(t)).map((x) => `${x.step}: ${x.t.slice(0, 60)}`);
    expect(bad).toEqual([]);
  });

  it('utilise l’apostrophe typographique dans le texte (hors code)', () => {
    const bad = all.filter(({ t }) => /[a-zà-ÿ]'[a-zà-ÿ]/i.test(t)).map((x) => `${x.step}: ${x.t.slice(0, 60)}`);
    expect(bad).toEqual([]);
  });

  it('le parcours tutoie l’élève', () => {
    expect(all.filter(({ t }) => /\b(vous|votre|vos)\b/i.test(t))).toEqual([]);
  });
});

describe('sûreté du contenu de confiance', () => {
  it('aucun script, gestionnaire d’événement ni lien externe dans les leçons et SVG', () => {
    for (const s of content.steps) {
      const html = [s.lesson, s.intro, ...(s.figures ?? []).map((f) => (f.type === 'svg' ? f.svg : ''))].join('\n');
      expect(html.replaceAll('http://www.w3.org/2000/svg', '')).not.toMatch(/<script|\son\w+\s*=|javascript:|https?:\/\//i);
    }
  });

  it('chaque figure SVG a un texte alternatif', () => {
    for (const s of content.steps) for (const f of s.figures ?? []) if (f.type === 'svg') expect(f.alt.length).toBeGreaterThan(5);
  });

  it('les figures de trace ont une fonction connue et des paramètres numériques', () => {
    for (const s of content.steps) {
      for (const f of s.figures ?? []) {
        if (f.type !== 'call-trace') continue;
        expect(['somme', 'factorielle', 'puissance', 'fibonacci']).toContain(f.fn);
        f.args.forEach((a) => expect(Number.isInteger(a)).toBe(true));
      }
    }
  });
});

describe('corrigé enseignant (privé)', () => {
  const CORRIGE = readFileSync(path.join(process.cwd(), 'docs/espace/corriges/nsi-recursivite/corrige.html'), 'utf8');

  it('se rend sans erreur et contient solutions, traces et diagnostic des difficultés', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { renderCorrigeBody } = require('@/lib/espace/corrige-render') as typeof import('@/lib/espace/corrige-render');
    const body = renderCorrigeBody(CORRIGE, content);
    expect(body).toContain('def compter_fichiers(element)');
    expect(body).toContain('def indice_dicho');
    expect(body).toContain('Trace d’exécution');
    expect(body).toContain('Interventions pédagogiques possibles');
    expect(body).toContain('Comment diagnostiquer une mauvaise compréhension');
    expect(body).toContain('Points de vigilance');
    expect(body).toContain('Compétences suivies');
  });

  it.each([
    'L’élève sait écrire la syntaxe mais ne comprend pas la récursion',
    'L’élève oublie le cas de base',
    'L’élève comprend la descente mais pas les retours',
  ])('diagnostic de compréhension : %s', (title) => {
    expect(CORRIGE.replace(/&#x27;/g, '’')).toContain(title);
  });

  it('donne une réponse attendue pour chaque question et chaque champ', () => {
    for (const s of content.steps) {
      const html = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      for (const q of s.questions) expect(CORRIGE).toContain(html(q.text));
      for (const f of s.fields) expect(CORRIGE).toContain(html(f.label));
    }
  });

  const suite = hasPython ? it : it.skip;
  suite('content.json et le corrigé sont à jour par rapport au générateur (aucune dérive manuelle)', () => {
    const script = `import json, sys; sys.dont_write_bytecode = True; sys.path.insert(0, ${JSON.stringify(DIR)}); import build_content as b; print(json.dumps({'content': b.CONTENT, 'corrige': b.corrige_html()}))`;
    const out = spawnSync('python3', ['-c', script], { encoding: 'utf8' });
    expect(out.status).toBe(0);
    const gen = JSON.parse(out.stdout) as { content: unknown; corrige: string };
    expect(gen.content).toEqual(content);
    expect(gen.corrige).toBe(CORRIGE);
  });

  it('n’est pas servi côté public : le dossier docs/ n’est pas sous public/', () => {
    expect(path.relative(path.join(process.cwd(), 'public'), path.join(process.cwd(), 'docs/espace/corriges/nsi-recursivite/corrige.html')).startsWith('..')).toBe(true);
  });
});
