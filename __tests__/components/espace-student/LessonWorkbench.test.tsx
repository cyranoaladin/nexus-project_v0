import { fireEvent, render, screen, within } from '@testing-library/react';

const edit = jest.fn();
let syncMock: Record<string, unknown>;

jest.mock('@/components/espace/shared/useWorkSync', () => ({ useWorkSync: () => syncMock }));
jest.mock('@/lib/espace/client/python-runner', () => ({ PythonRunner: jest.fn().mockImplementation(() => ({ run: jest.fn(), terminate: jest.fn() })) }));
jest.mock('@/components/espace/student/figures/FigureView', () => ({
  FigureView: ({ spec, overlay }: { spec: { id: string }; overlay?: string | null }) => <div data-testid={`fig-${spec.id}`}>{overlay ?? 'sans-overlay'}</div>,
}));

import { LessonWorkbench, type LessonWorkbenchProps } from '@/components/espace/student/LessonWorkbench';
import type { LessonContent } from '@/lib/espace/lesson-types';

const lesson: LessonContent = {
  version: 'test',
  title: 'Limites',
  session: 'Maths',
  duration: 60,
  ui: { phases: true },
  steps: [
    {
      id: 's1', short: 'Asymptote', title: 'Asymptote verticale', minutes: 10, level: 'Noyau', concepts: [],
      intro: 'Soit \\(g(x)=\\frac{2x+1}{x-1}\\).',
      lesson: '<p>Avant la question.</p>{{fig:courbe}}<p>Entre les deux.</p>{{q:signe}}<p>Après.</p>{{f:lim}}',
      task: 'Calcule la limite en \\(1^+\\).',
      starter: null,
      questions: [{ id: 'signe', text: 'Signe de \\(x-1\\) à droite de 1 ?', choices: ['négatif', 'positif'], correct: 1, feedback: 'À droite de 1, x−1>0.', choiceFeedback: ['Pense à x=1,1.', ''] }],
      fields: [
        {
          id: 'lim', label: 'Limite de g en \\(1^+\\)', input: 'line',
          check: { kind: 'limit', accept: ['+inf'], rules: [{ when: ['-inf'], feedback: 'Regarde le signe du dénominateur.' }], success: 'Oui.' },
        },
        { id: 'just', label: 'Justifie.' },
        { id: 'tang', label: 'Tangente', input: 'line', check: { kind: 'linear', accept: ['y=-3x-1'] } },
      ],
      hints: ['Indice un', 'Indice deux'],
      takeaway: 'Le signe décide.',
      tests: [],
      figures: [
        { type: 'function', id: 'courbe', fn: { kind: 'rational', num: [1, 2], den: [-1, 1] }, window: { xmin: -5, xmax: 5, ymin: -5, ymax: 5 } },
        { type: 'function', id: 'tg', fn: { kind: 'rational', num: [1, 2], den: [-1, 1] }, window: { xmin: -5, xmax: 5, ymin: -5, ymax: 5 }, overlayFieldId: 'tang' },
      ],
    },
    { id: 'fiche', short: 'Fiche', title: 'Fiche', minutes: 5, level: 'Synthèse', concepts: [], intro: '', lesson: '<p>Méthodes</p>', task: 'Relis.', starter: null, questions: [], fields: [], hints: [], takeaway: '', tests: [], printable: true },
  ],
};

function setup(steps: Record<string, unknown> = {}, over: Partial<LessonWorkbenchProps['work']> = {}) {
  const work = { id: 'w1', status: 'IN_PROGRESS' as const, revision: 1, currentStep: 0, lastSavedAt: '2026-10-03T08:00:00Z', steps: steps as never, ...over };
  syncMock = { state: 'saved', steps: work.steps, edit, conflict: null, resolveConflict: jest.fn(), submit: jest.fn(), lastSavedAt: null };
  return render(<LessonWorkbench userId="u1" work={work} content={lesson} runnerSource={null} annotations={[]} />);
}

beforeEach(() => edit.mockReset());

describe('formules et phases', () => {
  it('rend les formules en KaTeX dans l’introduction, la consigne, les questions et les libellés', () => {
    const { container } = setup();
    expect(container.querySelectorAll('.katex').length).toBeGreaterThanOrEqual(4);
    expect(container.textContent).not.toContain('\\(');
    expect(container.textContent).not.toContain('\\)');
  });

  it('affiche la hiérarchie Je comprends / J’essaie / Je retiens quand elle est activée', () => {
    setup();
    const labels = screen.getAllByTestId('phase').map((n) => n.textContent);
    expect(labels).toEqual(expect.arrayContaining(['Je comprends', 'Je retiens']));
    expect(screen.getByText('J’essaie')).toBeInTheDocument();
  });
});

describe('intercalation par jetons', () => {
  it('place la figure, la question et le champ AU MILIEU du cours, dans l’ordre du texte', () => {
    const { container } = setup();
    const text = container.querySelector('article')!.textContent!;
    const order = ['Avant la question.', 'sans-overlay', 'Entre les deux.', 'Signe de', 'Après.', 'Limite de g'].map((s) => text.indexOf(s));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('une figure non placée par un jeton est affichée après le cours (J’observe), et jamais deux fois une figure placée', () => {
    setup();
    expect(screen.getAllByTestId('fig-courbe')).toHaveLength(1);
    expect(screen.getAllByTestId('fig-tg')).toHaveLength(1);
    expect(screen.getByText('J’observe')).toBeInTheDocument();
  });

  it('un champ placé par jeton n’est pas répété en bas de page', () => {
    setup();
    expect(screen.getAllByLabelText(/Limite de g/)).toHaveLength(1);
  });
});

describe('vérification des réponses', () => {
  it('une réponse juste est confirmée et les essais sont enregistrés', () => {
    setup({ s1: { fields: { lim: '+∞' } } });
    const field = screen.getByLabelText(/Limite de g/);
    fireEvent.click(within(field.closest('div')!).getByRole('button', { name: 'Je vérifie' }));
    expect(screen.getAllByTestId('check-feedback')[0]).toHaveTextContent('Correct. Oui.');
    expect(edit).toHaveBeenCalledWith('s1', expect.objectContaining({ tries: { lim: 1 }, solved: { lim: true } }), expect.anything());
  });

  it('une erreur reconnue donne un message ciblé, jamais « Faux. »', () => {
    setup({ s1: { fields: { lim: '−∞' } } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Je vérifie' })[0]!);
    expect(screen.getAllByTestId('check-feedback')[0]).toHaveTextContent('Regarde le signe du dénominateur.');
    expect(screen.getAllByTestId('check-feedback')[0]).not.toHaveTextContent(/^Faux/);
    expect(edit).toHaveBeenCalledWith('s1', expect.objectContaining({ tries: { lim: 1 }, solved: { lim: false } }), expect.anything());
  });

  it('une réponse vide ne compte pas comme un essai', () => {
    setup();
    fireEvent.click(screen.getAllByRole('button', { name: 'Je vérifie' })[0]!);
    expect(screen.getAllByTestId('check-feedback')[0]).toHaveTextContent('Écris ta réponse');
    expect(edit).not.toHaveBeenCalled();
  });

  it('Entrée dans un champ court vérifie la réponse', () => {
    setup({ s1: { fields: { lim: '+inf' } } });
    fireEvent.keyDown(screen.getByLabelText(/Limite de g/), { key: 'Enter' });
    expect(screen.getAllByTestId('check-feedback')[0]).toHaveTextContent('Correct.');
  });

  it('un travail remis ne peut plus être vérifié ni modifié', () => {
    setup({ s1: { fields: { lim: '+inf' } } }, { status: 'SUBMITTED' });
    expect(screen.getAllByRole('button', { name: 'Je vérifie' })[0]).toBeDisabled();
  });

  it('un résultat déjà validé reste signalé après rechargement', () => {
    setup({ s1: { fields: { lim: '+inf' }, tries: { lim: 2 }, solved: { lim: true } } });
    expect(screen.getAllByTestId('check-feedback')[0]).toHaveTextContent('Réponse déjà validée (2 essais)');
  });
});

describe('figure liée à la saisie', () => {
  it('la saisie de l’élève est transmise à la figure (tangente tracée en pointillés)', () => {
    setup({ s1: { fields: { tang: 'y=-3x-1' } } });
    expect(screen.getByTestId('fig-tg')).toHaveTextContent('y=-3x-1');
  });
});

describe('QCM à retour ciblé', () => {
  it('ajoute le message propre au choix tentant avant l’explication générale', () => {
    setup({ s1: { choices: { signe: 0 } } });
    expect(screen.getByTestId('qcm-feedback')).toHaveTextContent('Pense à x=1,1. À droite de 1, x−1>0.');
  });
  it('la bonne réponse n’affiche que l’explication', () => {
    setup({ s1: { choices: { signe: 1 } } });
    expect(screen.getByTestId('qcm-feedback')).toHaveTextContent('Bonne réponse. À droite de 1');
    expect(screen.getByTestId('qcm-feedback')).not.toHaveTextContent('Pense à');
  });
});

describe('aides', () => {
  it('l’ouverture d’une aide est enregistrée (information, jamais une pénalité)', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Un indice ?' }));
    expect(screen.getByText(/Indice un/)).toBeInTheDocument();
    expect(edit).toHaveBeenCalledWith('s1', expect.objectContaining({ hints: 1 }), expect.anything());
  });
  it('les aides déjà ouvertes sont restaurées', () => {
    setup({ s1: { hints: 2 } });
    expect(screen.getByText(/Indice deux/)).toBeInTheDocument();
  });
});

describe('fiche imprimable', () => {
  it('propose l’impression et marque la zone à imprimer', () => {
    const print = jest.spyOn(window, 'print').mockImplementation(() => undefined);
    const { container } = setup({}, { currentStep: 1 });
    fireEvent.click(screen.getByRole('button', { name: /Imprimer la fiche/ }));
    expect(print).toHaveBeenCalled();
    expect(container.querySelector('#print-sheet')).not.toBeNull();
  });
});
