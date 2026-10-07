/**
 * @jest-environment node
 *
 * Intégrité du contenu du TP POO 2 (content/espace/nsi-structures-lineaires/content.json) :
 * cohérence avec le harnais Python, jetons d'intercalation, pédagogie des questions,
 * typographie française, et — surtout — absence de toute solution côté élève.
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { getLesson, getLessonRequiredSteps, getLessonSteps } from '@/lib/espace/catalog';
import { POO2_ACTIVITY_SLUG } from '@/lib/espace/lesson-routes';
import type { LessonContent, LessonStep } from '@/lib/espace/lesson-types';

const DIR = path.join(process.cwd(), 'content/espace/nsi-structures-lineaires');
const content = JSON.parse(readFileSync(path.join(DIR, 'content.json'), 'utf8')) as LessonContent;
const RAW = readFileSync(path.join(DIR, 'content.json'), 'utf8');
const hasPython = spawnSync('python3', ['--version']).status === 0;

const step = (id: string): LessonStep => content.steps.find((s) => s.id === id)!;

/** Texte lisible d'une étape : tout sauf code, SVG et balises. */
function prose(s: LessonStep): string[] {
  const strip = (h: string) => h.replace(/<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>|<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ');
  return [
    s.title, s.level, strip(s.intro), strip(s.lesson), s.task, s.takeaway, ...s.hints,
    ...s.questions.flatMap((q) => [q.text, ...q.choices, q.feedback, ...(q.choiceFeedback ?? [])]),
    ...s.fields.flatMap((f) => [f.label, f.placeholder ?? '', f.check?.success ?? '', f.check?.fallback ?? '', ...(f.check?.rules?.map((r) => r.feedback) ?? [])]),
  ];
}

describe('structure du parcours', () => {
  it('suit la progression attendue', () => {
    expect(content.steps.map((s) => s.id)).toEqual(['reactivation', 'types-abstraits', 'liste', 'pile', 'file', 'comparer', 'mission', 'synthese', 'bonus']);
  });

  it('dure environ 2 h hors bonus et le bonus ne compte pas', () => {
    const required = content.steps.filter((s) => s.id !== 'bonus');
    const total = required.reduce((n, s) => n + s.minutes, 0);
    expect(total).toBeGreaterThanOrEqual(105);
    expect(total).toBeLessThanOrEqual(content.duration);
    expect(content.duration).toBe(120);
    expect(step('bonus').minutes).toBe(0);
  });

  it('est enregistré au catalogue sous son identifiant, bonus facultatif', () => {
    expect(POO2_ACTIVITY_SLUG).toBe('nsi-poo-structures-lineaires');
    expect(getLesson(POO2_ACTIVITY_SLUG)).toBeDefined();
    expect(getLessonSteps(POO2_ACTIVITY_SLUG)).toHaveLength(9);
    expect(getLessonRequiredSteps(POO2_ACTIVITY_SLUG).map((s) => s.id)).not.toContain('bonus');
  });

  it('a des identifiants uniques (étapes, questions, champs, figures)', () => {
    expect(new Set(content.steps.map((s) => s.id)).size).toBe(content.steps.length);
    for (const s of content.steps) {
      for (const list of [s.questions.map((q) => q.id), s.fields.map((f) => f.id), (s.figures ?? []).map((f) => f.id)]) {
        expect(new Set(list).size).toBe(list.length);
      }
    }
  });

  it('couvre les notions demandées', () => {
    const all = content.steps.flatMap((s) => s.concepts).join(' ').toLowerCase();
    for (const notion of ['type abstrait', 'interface', 'implémentation', 'lifo', 'fifo', 'ioerror'.replace('ioerror', 'indexerror'), 'classe']) {
      expect(all + ' ' + RAW.toLowerCase()).toContain(notion);
    }
    expect(step('types-abstraits').lesson).toMatch(/liste[\s\S]*list|list[\s\S]*liste/); // distinction « liste » / list Python
  });
});

describe('intercalation explication / essai', () => {
  it.each(content.steps.map((s) => s.id))('« %s » : chaque jeton désigne un élément existant et chaque élément est placé', (id) => {
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
    for (const x of q) expect(s.lesson).toContain(`{{q:${x}}}`);
    for (const x of f) expect(s.lesson).toContain(`{{f:${x}}}`);
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
    // jamais un simple « Faux »
    q.choiceFeedback!.forEach((m) => expect(m.trim().toLowerCase()).not.toMatch(/^(faux|non|mauvaise réponse)\.?$/));
    expect(q.feedback.length).toBeGreaterThan(20);
  });

  it('les bonnes réponses ne sont pas toujours à la même place', () => {
    const positions = new Set(all.map((x) => x.q.correct));
    expect(positions.size).toBeGreaterThanOrEqual(3);
  });

  it('la situation « playlist » de la synthèse a bien pour réponse la liste, pas une structure LIFO/FIFO', () => {
    const q = step('synthese').questions.find((x) => x.id === 'playlist')!;
    expect(q.choices[q.correct]).toBe('Liste');
  });
});

describe('champs de réponse vérifiables', () => {
  it('la comparaison pile/file distingue les deux ordres de sortie et corrige la confusion', () => {
    const fields = step('comparer').fields;
    const pile = fields.find((f) => f.id === 'sortie-pile')!.check!;
    const file = fields.find((f) => f.id === 'sortie-file')!.check!;
    expect(pile.accept).toContain('D, C, B, A');
    expect(file.accept).toContain('A, B, C, D');
    expect(pile.rules![0].when).toContain('A, B, C, D');
    expect(pile.rules![0].feedback).toMatch(/file/i);
    expect(file.rules![0].feedback).toMatch(/pile/i);
  });
});

describe('cohérence avec le harnais Python', () => {
  const suite = hasPython ? it : it.skip;

  suite.each(['liste', 'pile', 'file', 'mission', 'bonus'])('« %s » : les intitulés de contrôle du contenu sont exactement ceux du harnais', (id) => {
    const solutions = spawnSync('python3', ['-c', `import json,sys; sys.dont_write_bytecode = True; sys.path.insert(0, ${JSON.stringify(DIR)}); import solutions; print(json.dumps(solutions.SOLUTIONS))`], { encoding: 'utf8' });
    const code = (JSON.parse(solutions.stdout) as Record<string, string>)[id];
    const script = `
import json, sys
exec(open(${JSON.stringify(path.join(DIR, 'runner.py'))}, encoding='utf8').read())
d = json.loads(sys.stdin.read())
print(json.dumps([t['label'] for t in run_submission(d['code'], d['step'], 'test')['tests']]))
`;
    const out = spawnSync('python3', ['-c', script], { input: JSON.stringify({ code, step: id }), encoding: 'utf8' });
    const labels = JSON.parse(out.stdout) as string[];
    expect(step(id).tests).toEqual(labels);
  });

  suite('les codes de départ du contenu sont ceux de solutions.py', () => {
    const out = spawnSync('python3', ['-c', `import json,sys; sys.dont_write_bytecode = True; sys.path.insert(0, ${JSON.stringify(DIR)}); import solutions; print(json.dumps(solutions.STARTERS))`], { encoding: 'utf8' });
    const starters = JSON.parse(out.stdout) as Record<string, string>;
    for (const [id, code] of Object.entries(starters)) expect(step(id).starter).toBe(code);
  });

  it('les étapes sans éditeur n’ont ni code de départ ni contrôle', () => {
    for (const id of ['reactivation', 'types-abstraits', 'comparer', 'synthese']) {
      expect(step(id).starter).toBeNull();
      expect(step(id).tests).toEqual([]);
    }
  });
});

describe('aucune solution côté élève', () => {
  it('hors indices, content.json ne contient aucun corps de méthode de Liste/Pile/File', () => {
    // Fragments caractéristiques des solutions : ils ne figurent que dans solutions.py et le corrigé enseignant
    // (les indices de niveau 3 peuvent citer UNE ligne, jamais une méthode entière : voir le test suivant).
    // La mission FOURNIT volontairement les classes File et Pile déjà construites : on ne contrôle que la partie à écrire.
    const withoutHints = JSON.stringify(
      content.steps.map((s) => ({ ...s, hints: [], starter: s.id === 'mission' ? s.starter!.slice(s.starter!.indexOf('# ── Partie A')) : s.starter })),
    );
    for (const frag of [
      'return self._elements.pop()',
      'return self._elements.pop(0)',
      'self._elements.append(valeur)\\n',
      'self._elements.popleft()\\n',
      'self._historique.empiler((nom, self._valeurs[nom]))\\n        self._valeurs[nom] = valeur',
      'nom, ancienne = self._historique.depiler()\\n        self._valeurs[nom] = ancienne',
      'self._attente = File()\\n',
    ]) {
      expect(withoutHints).not.toContain(frag);
    }
  });

  it('seuls les fragments de l’indice « fragment » apparaissent, en prose, jamais comme bloc de code complet', () => {
    for (const id of ['liste', 'pile', 'file', 'mission']) {
      const hints = step(id).hints;
      expect(hints).toHaveLength(3); // rappel / pseudo-code / fragment
      hints.forEach((h) => expect(h).not.toMatch(/<pre|```|def |\\n/));
    }
  });

  it('les starters ne résolvent rien : toutes les méthodes à compléter sont des « pass »', () => {
    for (const id of ['liste', 'pile', 'file']) expect((step(id).starter!.match(/^\s+pass$/gm) ?? []).length).toBeGreaterThanOrEqual(4);
    expect((step('mission').starter!.match(/^\s+pass$/gm) ?? []).length).toBeGreaterThanOrEqual(8);
  });
});

describe('typographie française', () => {
  const all = content.steps.flatMap((s) => prose(s).map((t) => ({ step: s.id, t })));

  it('aucune espace ordinaire avant ? ! ; : (hors code)', () => {
    const bad = all.filter(({ t }) => /[^\s] [?!;:]/.test(t)).map((x) => `${x.step}: ${x.t.slice(0, 60)}`);
    expect(bad).toEqual([]);
  });

  it('les guillemets français sont suivis/précédés d’une espace insécable', () => {
    const bad = all.filter(({ t }) => /«(?! )|(?<! )»/.test(t)).map((x) => `${x.step}: ${x.t.slice(0, 60)}`);
    expect(bad).toEqual([]);
  });

  it('utilise l’apostrophe typographique dans le texte (hors code)', () => {
    const bad = all.filter(({ t }) => /[a-zà-ÿ]'[a-zà-ÿ]/i.test(t)).map((x) => `${x.step}: ${x.t.slice(0, 60)}`);
    expect(bad).toEqual([]);
  });

  it('vouvoiement interdit : le parcours tutoie l’élève', () => {
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

  it('les simulateurs ont un mode valide', () => {
    for (const s of content.steps) for (const f of s.figures ?? []) if (f.type === 'structure-sim') expect(['liste', 'pile', 'file']).toContain(f.mode);
  });
});

describe('corrigé enseignant (privé)', () => {
  const CORRIGE = readFileSync(path.join(process.cwd(), 'docs/espace/corriges/nsi-poo2/corrige.html'), 'utf8');

  it('se rend sans erreur et contient les solutions de référence', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { renderCorrigeBody } = require('@/lib/espace/corrige-render') as typeof import('@/lib/espace/corrige-render');
    const body = renderCorrigeBody(CORRIGE, content);
    expect(body).toContain('class Pile:');
    expect(body).toContain('class FileImpression:');
    expect(body).toContain('self._historique.empiler((nom, self._valeurs[nom]))');
    expect(body).toContain('Points de vigilance');
  });

  it('donne une réponse attendue pour chaque question et chaque champ', () => {
    for (const s of content.steps) {
      for (const q of s.questions) expect(CORRIGE).toContain(q.text.replace(/&/g, '&amp;'));
      for (const f of s.fields) expect(CORRIGE).toContain(f.label.replace(/&/g, '&amp;'));
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
    expect(path.relative(path.join(process.cwd(), 'public'), path.join(process.cwd(), 'docs/espace/corriges/nsi-poo2/corrige.html')).startsWith('..')).toBe(true);
  });
});
