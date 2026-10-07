import { renderToStaticMarkup } from 'react-dom/server';

import { WorkViewer, type ViewerStepDef } from '@/components/espace/teacher/WorkViewer';
import { bilanViewerSteps } from '@/lib/espace/bilan-display';

const PAYLOAD = '<img src=x onerror=alert(1)>';
const defs: ViewerStepDef[] = [
  {
    id: 'agir',
    title: 'Modifier un état',
    short: 'Faire agir',
    starter: 'class A: pass',
    questions: [{ id: 'echec', text: 'Que renvoie le second appel ?', choices: ['False', 'True', 'None'], correct: 0 }],
    fields: [{ id: 'caslimite', label: 'Explique un test' }],
  },
];

const render = (content: Record<string, unknown>, attachments = [] as { id: string; originalName: string; mimeType: string; sizeBytes: number }[]) =>
  renderToStaticMarkup(<WorkViewer workId="w1" steps={defs} content={{ steps: content as never }} attachments={attachments} />);

describe('WorkViewer — texte d’élève jamais interprété', () => {
  it('exclut les anciennes autoévaluations selon le périmètre de la version consultée', () => {
    const markup = (status: string) => renderToStaticMarkup(<WorkViewer workId="b1" steps={bilanViewerSteps('3e')} attachments={[]} content={{ steps: { scope: { fields: { '3-arith': status } }, mastery: { fields: { '3-div-s': 'alone' } } } }} />);
    expect(markup('no')).not.toContain('data-testid="field-mastery-3-div-s"');
    expect(markup('yes')).toContain('data-testid="field-mastery-3-div-s"');
  });
  it('échappe le code, les réponses libres et les noms de fichiers', () => {
    const html = render(
      { agir: { code: `print("${PAYLOAD}")`, fields: { caslimite: `${PAYLOAD}<script>alert(2)</script>` }, choices: { echec: 0 } } },
      [{ id: 'a1', originalName: `${PAYLOAD}.pdf`, mimeType: 'application/pdf', sizeBytes: 2048 }],
    );
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;script&gt;alert(2)&lt;/script&gt;');
  });

  it('numérote les lignes et garde le code dans <pre><code>', () => {
    const html = render({ agir: { code: 'a = 1\nb = 2' } });
    expect(html).toMatch(/<pre[^>]*><code[^>]*data-testid="code-agir"/);
    expect(html).toContain('>1<');
    expect(html).toContain('>2<');
  });

  it('marque le choix de l’élève et la bonne réponse avec du texte, pas seulement des icônes', () => {
    const wrong = render({ agir: { choices: { echec: 1 } } });
    expect(wrong).toContain('Choix de l’élève');
    expect(wrong).toContain('réponse attendue différente');
    expect(wrong).toContain('Bonne réponse');
    const right = render({ agir: { choices: { echec: 0 } } });
    expect(right).toContain('(bonne réponse)');
  });

  it('indique les étapes et réponses absentes', () => {
    const html = render({});
    expect(html).toContain('Étape non renseignée.');
  });

  it('affiche les tests formatifs comme indicatifs', () => {
    const html = render({ agir: { code: 'x', tests: { passed: 1, total: 3 } } });
    expect(html).toContain('1/3 réussis');
  });

  it('lien de téléchargement vers la route authentifiée, jamais un chemin de fichier', () => {
    const html = render({}, [{ id: 'att9', originalName: 'copie.pdf', mimeType: 'application/pdf', sizeBytes: 1 }]);
    expect(html).toContain('href="/api/espace/works/w1/attachments/att9"');
  });

  it('sans callbacks : aucun bouton (vue strictement passive)', () => {
    expect(render({ agir: { code: 'x' } })).not.toContain('<button');
  });
});

it('preserves multiline code inside a pedagogical field label', () => {
  const multiline = 'Observer le programme :\ndef f(n):\n    return n + 1';
  const html = renderToStaticMarkup(<WorkViewer workId="synthetic-work" steps={[{ ...defs[0], fields:[{id:'trace', label:multiline}] }]} content={{steps:{}}} attachments={[]} />);
  const container = document.createElement('div'); container.innerHTML = html;
  const label = container.querySelector('dt')!;
  expect(label.textContent).toBe(multiline);
  expect(label).toHaveClass('whitespace-pre-wrap');
});

it.each(['no', 'unsure', undefined])('hides a task when its other prerequisite module is not confirmed (%s)', status => {
  const steps = [{...defs[0], id:'evidence', fields:[{id:'cross-module',label:'Essai avec prérequis',scopeModule:'primary',requiredScopeModules:['primary','prerequisite']}]}];
  const markup = (value: string | undefined) => renderToStaticMarkup(<WorkViewer workId="synthetic-cross-module" steps={steps} content={{steps:{scope:{fields:{primary:'yes', ...(value ? {prerequisite:value} : {})}},evidence:{fields:{'cross-module':'ancienne trace'}}}}} attachments={[]} />);
  expect(markup(status)).not.toContain('Essai avec prérequis');
  expect(markup('yes')).toContain('Essai avec prérequis');
});
