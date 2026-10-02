import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const upload = jest.fn();
const deleteAttachment = jest.fn();
const getWork = jest.fn();
const fetchMock = jest.fn();

jest.mock('@/lib/espace/client/api', () => {
  class EspaceApiError extends Error {
    constructor(readonly status: number, readonly code: string, message: string) {
      super(message);
    }
  }
  return { EspaceApiError, espaceApi: { upload: (...a: unknown[]) => upload(...a), deleteAttachment: (...a: unknown[]) => deleteAttachment(...a), getWork: (...a: unknown[]) => getWork(...a) } };
});

import { SuitesWorkspace } from '@/components/espace/student/SuitesWorkspace';
import { EspaceApiError } from '@/lib/espace/client/api';

const base = {
  workId: 'w1',
  activitySlug: 'maths-suites-synthese',
  title: 'Suites — Sujet de synthèse',
  status: 'DRAFT' as const,
  resources: [{ key: 'subject', label: 'Sujet de synthèse' }],
  attachments: [],
  annotations: [],
};
const file = () => new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], 'copie.pdf', { type: 'application/pdf' });

beforeEach(() => {
  upload.mockReset();
  deleteAttachment.mockReset();
  getWork.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('ressources', () => {
  it('ne propose que le sujet, par une route authentifiée, jamais un corrigé', () => {
    const { container } = render(<SuitesWorkspace {...base} />);
    const link = screen.getByRole('link', { name: /Sujet de synthèse/ });
    expect(link).toHaveAttribute('href', '/api/espace/resources/maths-suites-synthese/subject');
    expect(container.innerHTML).not.toMatch(/correction|teacher-guide|Corrigé/i);
  });
});

describe('dépôt de copie', () => {
  it('« Remettre » est désactivé sans fichier', () => {
    render(<SuitesWorkspace {...base} />);
    expect(screen.getByTestId('btn-remettre')).toBeDisabled();
    expect(screen.getByText(/Ajoute au moins un fichier/)).toBeInTheDocument();
  });

  it('le champ fichier n’accepte que PDF, JPEG et PNG', () => {
    render(<SuitesWorkspace {...base} />);
    expect(screen.getByTestId('input-fichier')).toHaveAttribute('accept', 'application/pdf,image/jpeg,image/png');
  });

  it('envoie, liste avec la taille, puis permet de supprimer', async () => {
    upload.mockResolvedValue({ attachment: { id: 'f1', originalName: 'copie.pdf', mimeType: 'application/pdf', sizeBytes: 2048 } });
    deleteAttachment.mockResolvedValue({ ok: true });
    render(<SuitesWorkspace {...base} />);
    fireEvent.change(screen.getByTestId('input-fichier'), { target: { files: [file()] } });
    const list = await screen.findByTestId('fichiers');
    expect(list).toHaveTextContent('copie.pdf');
    expect(list).toHaveTextContent('2 Ko');
    expect(screen.getByTestId('btn-remettre')).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer copie.pdf' }));
    await waitFor(() => expect(screen.queryByTestId('fichiers')).toBeNull());
    expect(deleteAttachment).toHaveBeenCalledWith('w1', 'f1');
  });

  it('affiche une erreur sobre en français si le serveur refuse le fichier', async () => {
    upload.mockRejectedValue(new EspaceApiError(400, 'UPLOAD_REJECTED', 'Format non accepté : PDF, JPEG ou PNG uniquement'));
    render(<SuitesWorkspace {...base} />);
    fireEvent.change(screen.getByTestId('input-fichier'), { target: { files: [file()] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Format non accepté');
  });

  it('coupure réseau : message clair, rien n’est listé', async () => {
    upload.mockRejectedValue(new TypeError('network'));
    render(<SuitesWorkspace {...base} />);
    fireEvent.change(screen.getByTestId('input-fichier'), { target: { files: [file()] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/vérifie ta connexion/);
    expect(screen.queryByTestId('fichiers')).toBeNull();
  });
});

describe('remise', () => {
  const withFile = { ...base, status: 'IN_PROGRESS' as const, attachments: [{ id: 'f1', originalName: 'copie.pdf', mimeType: 'application/pdf', sizeBytes: 1000 }] };

  it('confirmation puis lecture seule', async () => {
    getWork.mockResolvedValue({ work: { revision: 7 } });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ work: { status: 'SUBMITTED' } }) });
    render(<SuitesWorkspace {...withFile} />);
    fireEvent.click(screen.getByTestId('btn-remettre'));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remettre' }));
    expect(await screen.findByTestId('work-banner')).toHaveTextContent(/Travail remis/);
    expect(fetchMock).toHaveBeenCalledWith('/api/espace/works/w1/submit', expect.objectContaining({ body: JSON.stringify({ baseRevision: 7 }) }));
    expect(screen.queryByTestId('btn-remettre')).toBeNull();
    expect(screen.queryByRole('button', { name: /Supprimer/ })).toBeNull();
    expect(screen.queryByTestId('input-fichier')).toBeNull();
  });

  it('déjà remis : aucune action de modification', () => {
    render(<SuitesWorkspace {...withFile} status="SUBMITTED" />);
    expect(screen.queryByTestId('btn-remettre')).toBeNull();
    expect(screen.queryByTestId('input-fichier')).toBeNull();
    expect(screen.queryByRole('button', { name: /Supprimer/ })).toBeNull();
  });

  it('retour d’enseignant affiché comme texte', () => {
    const { container } = render(
      <SuitesWorkspace
        {...withFile}
        status="CORRECTED"
        annotations={[{ id: 'a', kind: 'GENERAL', body: '<img src=x onerror=alert(1)>', stepId: null, questionId: null, lineStart: null, lineEnd: null, workRevision: 1, authorName: 'P', mine: false, createdAt: '' }]}
      />,
    );
    expect(container.querySelector('img[src="x"]')).toBeNull();
    expect(screen.getByTestId('annotation')).toHaveTextContent('<img src=x');
  });
});
