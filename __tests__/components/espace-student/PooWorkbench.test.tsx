import { fireEvent, render, screen, within } from '@testing-library/react';

const edit = jest.fn();
const resolveConflict = jest.fn();
const submit = jest.fn();
let syncMock: Record<string, unknown>;

jest.mock('@/components/espace/shared/useWorkSync', () => ({ useWorkSync: () => syncMock }));
jest.mock('@/lib/espace/client/python-runner', () => ({
  PythonRunner: jest.fn().mockImplementation(() => ({ run: jest.fn(), terminate: jest.fn() })),
}));

import { PooWorkbench, type PooWorkbenchProps } from '@/components/espace/student/PooWorkbench';
import { getPooContent } from '@/lib/espace/catalog';

const content = getPooContent();
const step0 = content.steps[0];
const HOSTILE = '<img src=x onerror=alert(1)>';

function setup(over: Partial<PooWorkbenchProps['work']> = {}, extra: Partial<PooWorkbenchProps> = {}, sync: Record<string, unknown> = {}) {
  const work: PooWorkbenchProps['work'] = {
    id: 'w1', status: 'IN_PROGRESS', revision: 3, currentStep: 0, lastSavedAt: '2026-10-02T17:42:00Z', steps: {}, ...over,
  };
  syncMock = { state: 'saved', steps: work.steps, edit, conflict: null, resolveConflict, submit, lastSavedAt: null, ...sync };
  return render(<PooWorkbench userId="u1" work={work} content={content} runnerSource="# runner" annotations={[]} {...extra} />);
}

beforeEach(() => {
  edit.mockReset();
  resolveConflict.mockReset();
  submit.mockReset();
});

describe('affichage', () => {
  it('montre l’étape reprise, la navigation et l’indicateur d’enregistrement', () => {
    setup({ currentStep: 2 });
    expect(screen.getByRole('heading', { level: 2, name: content.steps[2].title })).toBeInTheDocument();
    const current = within(screen.getByRole('navigation', { name: 'Étapes du TP' })).getByRole('button', { current: 'step' });
    expect(current).toHaveTextContent(content.steps[2].short);
    expect(screen.getByTestId('save-indicator')).toHaveAttribute('data-state', 'saved');
  });

  it('n’affiche aucun vestige de l’ancien parcours (code de séance, alias, JSON)', () => {
    const { container } = setup();
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/code de séance|E0\d|exporter|importer|\.json/i);
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });
});

describe('texte d’élève : jamais du HTML', () => {
  it('un champ contenant du HTML reste du texte', () => {
    const fieldId = step0.fields[0].id;
    const { container } = setup({ steps: { [step0.id]: { fields: { [fieldId]: HOSTILE } } } });
    expect(container.querySelector('img[src="x"]')).toBeNull();
    expect(screen.getByDisplayValue(HOSTILE)).toBeInTheDocument();
  });

  it('un retour d’enseignant contenant du HTML est affiché comme texte', () => {
    const { container } = setup({}, {
      annotations: [{ id: 'a1', kind: 'GENERAL', body: HOSTILE, stepId: null, questionId: null, lineStart: null, lineEnd: null, workRevision: 1, authorName: 'P', mine: false, createdAt: '' }],
    });
    expect(container.querySelector('img[src="x"]')).toBeNull();
    expect(screen.getByTestId('annotation')).toHaveTextContent(HOSTILE);
  });
});

describe('lecture seule', () => {
  it('travail remis : champs en lecture seule, pas de bouton de remise, bandeau explicite', () => {
    setup({ status: 'SUBMITTED' }, {}, { state: 'locked' });
    expect(screen.getByTestId('code-editor')).toHaveAttribute('readonly');
    expect(screen.queryByTestId('btn-remettre')).toBeNull();
    expect(screen.getByTestId('work-banner')).toHaveTextContent(/lecture seule/);
    fireEvent.change(screen.getByTestId('code-editor'), { target: { value: 'x' } });
    expect(edit).not.toHaveBeenCalled();
  });

  it('travail à reprendre : bandeau d’invitation et édition rouverte', () => {
    setup({ status: 'REOPENED' });
    expect(screen.getByTestId('work-banner')).toHaveTextContent('Ton enseignant te demande de reprendre ce travail.');
    expect(screen.getByTestId('code-editor')).not.toHaveAttribute('readonly');
    expect(screen.getByTestId('btn-remettre')).toBeInTheDocument();
  });

  it('remis depuis un autre onglet (état verrouillé) : lecture seule même si le statut reçu était « en cours »', () => {
    setup({ status: 'IN_PROGRESS' }, {}, { state: 'locked' });
    expect(screen.queryByTestId('btn-remettre')).toBeNull();
    expect(screen.getByTestId('code-editor')).toHaveAttribute('readonly');
  });
});

describe('édition et autosave', () => {
  it('une frappe appelle l’autosave avec l’étape courante', () => {
    setup({ currentStep: 1 });
    fireEvent.change(screen.getByTestId('code-editor'), { target: { value: 'x = 1' } });
    expect(edit).toHaveBeenCalledWith(content.steps[1].id, expect.objectContaining({ code: 'x = 1' }), expect.objectContaining({ currentStep: 1 }));
  });

  it('changer d’étape déclenche un instantané « changement d’étape »', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Étape suivante' }));
    expect(edit).toHaveBeenCalledWith(step0.id, {}, { currentStep: 1, snapshot: 'STEP_CHANGE' });
    expect(screen.getByRole('heading', { level: 2, name: content.steps[1].title })).toBeInTheDocument();
  });

  it('cliquer une réponse enregistre le choix', () => {
    setup();
    const q = step0.questions[0];
    const wrong = q.choices.findIndex((_, i) => i !== q.correct);
    fireEvent.click(screen.getAllByRole('radio')[wrong]);
    expect(edit).toHaveBeenCalledWith(step0.id, expect.objectContaining({ choices: { [q.id]: wrong } }), expect.anything());
  });

  it('le retour pédagogique dit « Bonne réponse » ou « Pas tout à fait », en texte (pas seulement en couleur)', () => {
    const q = step0.questions[0];
    const wrong = q.choices.findIndex((_, i) => i !== q.correct);
    const { unmount } = setup({ steps: { [step0.id]: { choices: { [q.id]: q.correct } } } });
    expect(screen.getAllByTestId('qcm-feedback')[0]).toHaveTextContent('Bonne réponse.');
    expect(screen.getAllByTestId('qcm-feedback')[0]).toHaveTextContent(q.feedback);
    unmount();
    setup({ steps: { [step0.id]: { choices: { [q.id]: wrong } } } });
    expect(screen.getAllByTestId('qcm-feedback')[0]).toHaveTextContent('Pas tout à fait.');
  });

  it('Tab insère 4 espaces ; Échap puis Tab laisse le focus quitter l’éditeur', () => {
    setup({ steps: { [step0.id]: { code: 'ab' } } });
    const editor = screen.getByTestId('code-editor') as HTMLTextAreaElement;
    editor.setSelectionRange(1, 1);
    const tab = fireEvent.keyDown(editor, { key: 'Tab' });
    expect(tab).toBe(false); // preventDefault appelé
    expect(edit).toHaveBeenCalledWith(step0.id, expect.objectContaining({ code: 'a    b' }), expect.anything());

    edit.mockReset();
    fireEvent.keyDown(editor, { key: 'Escape' });
    expect(fireEvent.keyDown(editor, { key: 'Tab' })).toBe(true); // non intercepté
    expect(edit).not.toHaveBeenCalled();
  });

  it('les indices apparaissent un par un', () => {
    setup();
    expect(screen.queryByText(/Indice 1/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Un indice.\?$/ }));
    expect(screen.getByText(/Indice 1 sur/)).toBeInTheDocument();
    expect(screen.queryByText(/Indice 2/)).toBeNull();
  });
});

describe('remise', () => {
  it('demande confirmation, avertit des étapes manquantes, et Annuler ne remet rien', () => {
    setup();
    fireEvent.click(screen.getByTestId('btn-remettre'));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent(/Il reste 7 étapes non renseignées/);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(submit).not.toHaveBeenCalled();
  });

  it('Échap ferme le dialogue sans remettre', () => {
    setup();
    fireEvent.click(screen.getByTestId('btn-remettre'));
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(submit).not.toHaveBeenCalled();
  });

  it('confirmer remet puis passe en lecture seule', async () => {
    submit.mockResolvedValue({ kind: 'ok', revision: 4 });
    setup();
    fireEvent.click(screen.getByTestId('btn-remettre'));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remettre' }));
    expect(await screen.findByTestId('work-banner')).toHaveTextContent(/Travail remis/);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.queryByTestId('btn-remettre')).toBeNull();
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('si le travail n’est pas enregistré côté serveur, la remise est bloquée avec un message sobre', async () => {
    submit.mockResolvedValue({ kind: 'blocked', reason: 'offline' });
    setup();
    fireEvent.click(screen.getByTestId('btn-remettre'));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remettre' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/pas encore enregistré/);
    expect(screen.getByTestId('btn-remettre')).toBeInTheDocument(); // toujours modifiable
  });
});

describe('conflit de version', () => {
  const conflict = { stepId: step0.id, mine: { code: 'ma version' }, theirs: { code: 'autre version' }, currentRevision: 5, currentSteps: {} };

  it('propose les deux choix et appelle la résolution correspondante', () => {
    setup({}, {}, { state: 'conflict', conflict });
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Garder ma version' }));
    expect(resolveConflict).toHaveBeenLastCalledWith('keep-mine');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Prendre l’autre version' }));
    expect(resolveConflict).toHaveBeenLastCalledWith('take-theirs');
  });

  it('le dialogue de conflit n’a pas de sortie par Échap : un choix explicite est exigé', () => {
    setup({}, {}, { state: 'conflict', conflict });
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(resolveConflict).not.toHaveBeenCalled();
  });
});
