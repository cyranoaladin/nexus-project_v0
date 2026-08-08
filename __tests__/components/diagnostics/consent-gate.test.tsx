import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ConsentGate } from '@/components/diagnostics/candidat-libre/ConsentGate';

/**
 * Écran de recueil du consentement — étudiant majeur.
 *
 * Trois propriétés de fond, que l'apparence ne doit pas masquer :
 *
 * - la notice est rendue **verbatim** telle que le serveur la fournit, et la
 *   **version présentée** est celle renvoyée — reformuler ou renvoyer autre
 *   chose rendrait le consentement non éclairé ;
 * - le partage avec le parent est **décoché par défaut** et n'est envoyé que si
 *   l'étudiant l'a explicitement coché ;
 * - consentir et partager sont **deux actes distincts**.
 */

const NOTICE = {
  version: 'candidat-libre-notice.v1',
  title: 'Ce que vous devez savoir avant de commencer',
  sections: [
    { heading: 'Qui traite les données', body: ['Nexus Réussite (STE M&M ACADEMY SUARL), Tunis.'] },
    { heading: 'Sur quelle base', body: ['Sur la base de votre consentement.'] },
  ],
  consentStatement: "J'ai lu et compris la présente notice. Je consens au traitement décrit.",
  consentCheckbox: 'Je consens au traitement décrit.',
};

function mockFetch(consentState: string, posted: unknown[] = []) {
  return jest.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      posted.push(JSON.parse(String(init.body)));
      return { ok: true, json: async () => ({ consentState: 'GRANTED' }) } as Response;
    }
    return { ok: true, json: async () => ({ notice: NOTICE, consentState }) } as Response;
  });
}

beforeEach(() => { jest.restoreAllMocks(); });

describe('ConsentGate — notice', () => {
  it('rend la notice verbatim, sans reformulation', async () => {
    global.fetch = mockFetch('MISSING') as unknown as typeof fetch;
    render(<ConsentGate studentId="stu_1" />);

    expect(await screen.findByText(NOTICE.title)).toBeInTheDocument();
    for (const section of NOTICE.sections) {
      expect(screen.getByText(section.heading)).toBeInTheDocument();
      for (const p of section.body) expect(screen.getByText(p)).toBeInTheDocument();
    }
  });

  /**
   * Le texte versionné ne dépend d'aucun dossier : le nom de l'étudiant n'y est
   * plus interpolé, sans quoi renseigner un nom ferait croire à un changement
   * du texte consenti.
   */
  it('n’interpole aucun nom dans le texte consenti', async () => {
    global.fetch = mockFetch('MISSING') as unknown as typeof fetch;
    render(<ConsentGate studentId="stu_1" />);
    expect(await screen.findByText(NOTICE.consentStatement)).toBeInTheDocument();
    expect(screen.queryByText(/\{\{/)).not.toBeInTheDocument();
  });

  it('affiche la version consentie', async () => {
    global.fetch = mockFetch('MISSING') as unknown as typeof fetch;
    render(<ConsentGate studentId="stu_1" />);
    expect(await screen.findByText(/candidat-libre-notice\.v1/)).toBeInTheDocument();
  });
});

describe('ConsentGate — consentement de l’étudiant', () => {
  it('n’active le bouton qu’après cochage explicite', async () => {
    global.fetch = mockFetch('MISSING') as unknown as typeof fetch;
    render(<ConsentGate studentId="stu_1" />);

    const button = await screen.findByRole('button', { name: /je consens/i });
    expect(button).toBeDisabled();

    await userEvent.click(screen.getByRole('checkbox', { name: /je consens au traitement/i }));
    expect(button).toBeEnabled();
  });

  it('enregistre le consentement de l’étudiant, avec la version présentée', async () => {
    const posted: unknown[] = [];
    global.fetch = mockFetch('MISSING', posted) as unknown as typeof fetch;
    render(<ConsentGate studentId="stu_1" />);

    await userEvent.click(await screen.findByRole('checkbox', { name: /je consens au traitement/i }));
    await userEvent.click(screen.getByRole('button', { name: /je consens/i }));

    await waitFor(() => expect(posted.length).toBeGreaterThan(0));
    expect(posted[0]).toMatchObject({
      action: 'GRANT_STUDENT_CONSENT',
      noticeVersion: NOTICE.version,
      studentId: 'stu_1',
    });
  });
});

describe('ConsentGate — partage avec le parent', () => {
  it('propose le partage décoché par défaut', async () => {
    global.fetch = mockFetch('MISSING') as unknown as typeof fetch;
    render(<ConsentGate studentId="stu_1" parentName="M. Ben Hadj Salem" />);

    const share = await screen.findByRole('checkbox', { name: /j’autorise M\. Ben Hadj Salem/i });
    expect(share).not.toBeChecked();
  });

  it('annonce que le partage est facultatif et révocable', async () => {
    global.fetch = mockFetch('MISSING') as unknown as typeof fetch;
    render(<ConsentGate studentId="stu_1" />);
    expect(await screen.findByText(/Facultatif/i)).toBeInTheDocument();
    expect(screen.getByText(/retirer à tout moment/i)).toBeInTheDocument();
  });

  /** Le cœur de la décision : consentir ne partage rien. */
  it('n’envoie aucune autorisation de partage si la case reste décochée', async () => {
    const posted: unknown[] = [];
    global.fetch = mockFetch('MISSING', posted) as unknown as typeof fetch;
    render(<ConsentGate studentId="stu_1" />);

    await userEvent.click(await screen.findByRole('checkbox', { name: /je consens au traitement/i }));
    await userEvent.click(screen.getByRole('button', { name: /je consens/i }));

    await waitFor(() => expect(posted.length).toBeGreaterThan(0));
    const actions = posted.map((p) => (p as { action: string }).action);
    expect(actions).toContain('GRANT_STUDENT_CONSENT');
    expect(actions).not.toContain('SET_PARENT_ACCESS');
  });

  it('envoie l’autorisation seulement si l’étudiant l’a cochée', async () => {
    const posted: unknown[] = [];
    global.fetch = mockFetch('MISSING', posted) as unknown as typeof fetch;
    render(<ConsentGate studentId="stu_1" parentName="M. Ben Hadj Salem" />);

    await userEvent.click(await screen.findByRole('checkbox', { name: /je consens au traitement/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /j’autorise/i }));
    await userEvent.click(screen.getByRole('button', { name: /je consens/i }));

    await waitFor(() => expect(posted.length).toBe(2));
    expect(posted[1]).toMatchObject({ action: 'SET_PARENT_ACCESS', parentAccess: true });
  });
});

describe('ConsentGate — états', () => {
  it('ne redemande rien quand le consentement est acquis', async () => {
    global.fetch = mockFetch('GRANTED') as unknown as typeof fetch;
    render(<ConsentGate studentId="stu_1" />);
    expect(await screen.findByText(/consentement est enregistré/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  /** Hors allowlist, l'API répond 404 : l'écran ne révèle rien du dossier. */
  it('reste discret quand le parcours n’est pas accessible', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
    render(<ConsentGate studentId="stu_1" />);
    expect(await screen.findByText(/n'est pas accessible avec ce compte/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
