import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

const push = jest.fn();
const refresh = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
jest.mock('@/lib/espace/client/api', () => {
  class EspaceApiError extends Error {
    constructor(readonly status: number, readonly code: string, message: string) {
      super(message);
    }
  }
  return {
    EspaceApiError,
    espaceApi: {
      snippets: jest.fn().mockResolvedValue({ snippets: [{ id: 's1', body: 'Vérifie le cas limite.' }] }),
      versions: jest.fn().mockResolvedValue({ versions: [] }),
      addAnnotation: jest.fn(),
      review: jest.fn(),
      deleteAnnotation: jest.fn(),
      addSnippet: jest.fn(),
      deleteSnippet: jest.fn(),
      version: jest.fn(),
    },
  };
});

import { CorrectionWorkspace } from '@/components/espace/teacher/CorrectionWorkspace';
import { EspaceProvider } from '@/components/espace/shared/EspaceProvider';
import { espaceApi } from '@/lib/espace/client/api';

const api = espaceApi as unknown as Record<string, jest.Mock>;

const steps = [{ id: 'agir', title: 'Modifier un état', short: 'Faire agir', starter: null, questions: [{ id: 'echec', text: 'Que renvoie le second appel ?', choices: ['False', 'True'], correct: 0 }], fields: [] }];
const queue = [
  { studentId: 's1', workId: 'w1', name: 'Ada A', status: 'SUBMITTED', progress: '5/7' },
  { studentId: 's2', workId: 'w2', name: 'Bob B', status: 'SUBMITTED', progress: '3/7' },
];

async function mount(over: Partial<React.ComponentProps<typeof CorrectionWorkspace>> = {}) {
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(
    <EspaceProvider timezone="Africa/Tunis">
      <CorrectionWorkspace
        work={{ id: 'w1', status: 'SUBMITTED', revision: 4, activityTitle: 'Des objets qui agissent', content: { steps: { agir: { code: 'x = 1', choices: { echec: 1 } } } } }}
        studentName="Ada A"
        steps={steps}
        attachments={[]}
        annotations={[]}
        queue={queue}
        isAdmin={false}
        {...over}
      />
    </EspaceProvider>,
    );
  });
  return view;
}

beforeEach(() => {
  jest.clearAllMocks();
  api.snippets.mockResolvedValue({ snippets: [{ id: 's1', body: 'Vérifie le cas limite.' }] });
  api.versions.mockResolvedValue({ versions: [] });
});

describe('CorrectionWorkspace', () => {
  it('refuse d’enregistrer un commentaire vide, avec une alerte accessible, sans appel réseau', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Écrivez un commentaire');
    expect(api.addAnnotation).not.toHaveBeenCalled();
  });

  it('enregistre un commentaire global puis l’affiche, avec confirmation', async () => {
    api.addAnnotation.mockResolvedValue({ annotation: { id: 'a1', kind: 'GENERAL', body: 'Bonne compréhension.', stepId: null, questionId: null, lineStart: null, lineEnd: null, workRevision: 4, authorName: 'Prof T', mine: true, createdAt: '2026-10-02T10:00:00Z' } });
    await mount();
    fireEvent.change(screen.getByLabelText('Commentaire'), { target: { value: 'Bonne compréhension.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(api.addAnnotation).toHaveBeenCalledWith('w1', { kind: 'GENERAL', body: 'Bonne compréhension.' }));
    expect(await screen.findByText('Annotation enregistrée.')).toBeInTheDocument();
    expect(screen.getAllByTestId('annotation')).toHaveLength(1);
  });

  it('un commentaire réutilisable s’insère dans le champ sans être obligatoire', async () => {
    await mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Vérifie le cas limite.' }));
    expect(screen.getByLabelText('Commentaire')).toHaveValue('Vérifie le cas limite.');
  });

  describe('compétences suivies (facultatif)', () => {
    const skills = [{ id: 'cas-de-base', label: 'Identifier le cas de base' }, { id: 'tracer', label: 'Tracer des appels récursifs' }];

    it('sans compétences, aucun sélecteur n’est affiché (les autres parcours sont inchangés)', async () => {
      await mount();
      expect(screen.queryByLabelText('Compétence')).not.toBeInTheDocument();
    });

    it('une compétence « Acquise » ou « À consolider » pré-remplit le commentaire existant, rien n’est enregistré tout seul', async () => {
      await mount({ skills });
      const select = screen.getByLabelText('Compétence');
      expect(screen.getByRole('button', { name: 'À consolider' })).toBeDisabled();
      fireEvent.change(select, { target: { value: 'cas-de-base' } });
      fireEvent.click(screen.getByRole('button', { name: 'À consolider' }));
      expect(screen.getByLabelText('Commentaire')).toHaveValue('Compétence «\u00a0Identifier le cas de base\u00a0»\u00a0: à consolider.');
      fireEvent.change(select, { target: { value: 'tracer' } });
      fireEvent.click(screen.getByRole('button', { name: 'Acquise' }));
      expect(screen.getByLabelText('Commentaire')).toHaveValue(
        'Compétence «\u00a0Identifier le cas de base\u00a0»\u00a0: à consolider.\nCompétence «\u00a0Tracer des appels récursifs\u00a0»\u00a0: acquise.',
      );
      expect(api.addAnnotation).not.toHaveBeenCalled();
    });
  });

  it('« Corrigé » enregistre d’abord le commentaire en cours puis change le statut', async () => {
    api.addAnnotation.mockResolvedValue({ annotation: { id: 'a2', kind: 'GENERAL', body: 'OK', stepId: null, questionId: null, lineStart: null, lineEnd: null, workRevision: 4, authorName: 'Prof T', mine: true, createdAt: '2026-10-02T10:00:00Z' } });
    api.review.mockResolvedValue({ work: { status: 'CORRECTED' } });
    await mount();
    fireEvent.change(screen.getByLabelText('Commentaire'), { target: { value: 'OK' } });
    fireEvent.click(screen.getByRole('button', { name: 'Corrigé' }));
    await waitFor(() => expect(api.review).toHaveBeenCalledWith('w1', 'MARK_CORRECTED'));
    expect(api.addAnnotation).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Terminé' })).toBeInTheDocument(); // disponible une fois corrigé
  });

  it('n’applique pas le statut si le commentaire en cours est invalide', async () => {
    await mount();
    fireEvent.change(screen.getByLabelText('Porte sur'), { target: { value: 'STEP' } });
    fireEvent.change(screen.getByLabelText('Commentaire'), { target: { value: 'Revois ceci' } });
    fireEvent.click(screen.getByRole('button', { name: 'À reprendre' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choisissez l’étape');
    expect(api.review).not.toHaveBeenCalled();
  });

  it('les actions suivent la machine d’états : travail en cours, aucune action de relecture', async () => {
    await mount({ work: { id: 'w1', status: 'IN_PROGRESS', revision: 1, activityTitle: 'X', content: { steps: {} } } });
    expect(screen.getByRole('button', { name: 'Corrigé' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'À reprendre' })).toBeDisabled();
  });

  it('« Élève suivant » mène au prochain travail remis sans repasser par le tableau de bord', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: /Élève suivant : Bob B/ }));
    expect(push).toHaveBeenCalledWith('/espace/enseignant/corriger/w2');
  });

  it('désactive « Élève suivant » quand il n’y en a pas', async () => {
    await mount({ queue: [queue[0]] });
    expect(screen.getByRole('button', { name: /Élève suivant/ })).toBeDisabled();
  });

  it('affiche une erreur sobre quand le serveur refuse', async () => {
    const { EspaceApiError } = jest.requireMock('@/lib/espace/client/api');
    api.review.mockRejectedValue(new EspaceApiError(409, 'INVALID_TRANSITION', 'Ce changement de statut n’est pas possible depuis l’état actuel'));
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Corrigé' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('pas possible');
  });

  it('suppression : proposée seulement pour ses propres annotations (admin : toutes)', async () => {
    const mine = { id: 'm', kind: 'GENERAL', body: 'a', stepId: null, questionId: null, lineStart: null, lineEnd: null, workRevision: 1, authorName: 'Prof T', mine: true, createdAt: '2026-10-02T10:00:00Z' };
    const theirs = { ...mine, id: 't', authorName: 'Autre Prof', mine: false };
    const { unmount } = await mount({ annotations: [mine, theirs] });
    expect(screen.getAllByRole('button', { name: /Supprimer/ })).toHaveLength(1);
    unmount();
    await mount({ annotations: [mine, theirs], isAdmin: true });
    expect(screen.getAllByRole('button', { name: /Supprimer/ })).toHaveLength(2);
  });

  it('ne propose aucun champ de saisie sur le contenu de l’élève', async () => {
    await mount();
    const viewer = screen.getByTestId('work-viewer');
    expect(viewer.querySelectorAll('input, textarea, select')).toHaveLength(0);
  });
});
