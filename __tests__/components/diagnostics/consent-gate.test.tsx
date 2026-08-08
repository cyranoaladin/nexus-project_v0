import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ConsentGate } from '@/components/diagnostics/candidat-libre/ConsentGate';

/**
 * Écran de recueil du consentement.
 *
 * Ce que ces tests protègent n'est pas l'apparence mais deux propriétés de
 * fond : la notice est rendue **verbatim** telle que le serveur la fournit, et
 * la **version présentée** est celle renvoyée au serveur. Reformuler le texte
 * ou renvoyer une autre version rendrait le consentement non éclairé.
 */

const NOTICE = {
  version: 'candidat-libre-notice.v1',
  title: 'Ce que vous devez savoir avant de commencer',
  sections: [
    { heading: 'Qui traite les données', body: ['Nexus Réussite (STE M&M ACADEMY SUARL), Tunis.'] },
    { heading: 'Sur quelle base', body: ['Sur la base de votre consentement.'] },
  ],
  parentConsentStatement: "En tant que titulaire de l'autorité parentale sur {{ELEVE_NOM}}, je consens.",
  parentConsentCheckbox: 'Je consens au traitement décrit, pour mon enfant mineur.',
  studentAssentStatement: "J'ai compris à quoi sert ce diagnostic et j'accepte d'y participer.",
};

function mockFetch(consentState: string, onPost?: (body: unknown) => void) {
  return jest.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      onPost?.(JSON.parse(String(init.body)));
      return { ok: true, json: async () => ({ consentState: 'GRANTED' }) } as Response;
    }
    return { ok: true, json: async () => ({ notice: NOTICE, consentState }) } as Response;
  });
}

beforeEach(() => { jest.restoreAllMocks(); });

describe('ConsentGate — écran parent', () => {
  it('rend la notice verbatim, sans reformulation', async () => {
    global.fetch = mockFetch('MISSING') as unknown as typeof fetch;
    render(<ConsentGate audience="PARENT" studentId="stu_1" studentName="Ahmed" />);

    expect(await screen.findByText(NOTICE.title)).toBeInTheDocument();
    for (const section of NOTICE.sections) {
      expect(screen.getByText(section.heading)).toBeInTheDocument();
      for (const paragraph of section.body) {
        expect(screen.getByText(paragraph)).toBeInTheDocument();
      }
    }
  });

  it('interpole le nom de l’élève dans l’engagement parental', async () => {
    global.fetch = mockFetch('MISSING') as unknown as typeof fetch;
    render(<ConsentGate audience="PARENT" studentId="stu_1" studentName="Ahmed" />);

    expect(await screen.findByText(/sur Ahmed, je consens/)).toBeInTheDocument();
    expect(screen.queryByText(/\{\{ELEVE_NOM\}\}/)).not.toBeInTheDocument();
  });

  it('n’active le consentement qu’après cochage explicite', async () => {
    global.fetch = mockFetch('MISSING') as unknown as typeof fetch;
    render(<ConsentGate audience="PARENT" studentId="stu_1" />);

    const button = await screen.findByRole('button', { name: /je consens/i });
    expect(button).toBeDisabled();

    await userEvent.click(screen.getByRole('checkbox'));
    expect(button).toBeEnabled();
  });

  it('renvoie la version réellement présentée', async () => {
    const posted: unknown[] = [];
    global.fetch = mockFetch('MISSING', (body) => posted.push(body)) as unknown as typeof fetch;
    render(<ConsentGate audience="PARENT" studentId="stu_1" />);

    await userEvent.click(await screen.findByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: /je consens/i }));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({
      action: 'GRANT_PARENTAL_CONSENT',
      noticeVersion: NOTICE.version,
      studentId: 'stu_1',
    });
  });

  it('affiche la version consentie, pour que la famille sache sur quoi elle s’engage', async () => {
    global.fetch = mockFetch('MISSING') as unknown as typeof fetch;
    render(<ConsentGate audience="PARENT" studentId="stu_1" />);
    expect(await screen.findByText(/candidat-libre-notice\.v1/)).toBeInTheDocument();
  });
});

describe('ConsentGate — écran élève', () => {
  it('recueille un assentiment distinct, dans sa propre formulation', async () => {
    const posted: unknown[] = [];
    global.fetch = mockFetch('STUDENT_ASSENT_MISSING', (b) => posted.push(b)) as unknown as typeof fetch;
    render(<ConsentGate audience="ELEVE" />);

    expect(await screen.findByText(NOTICE.studentAssentStatement)).toBeInTheDocument();
    expect(screen.queryByText(/autorité parentale/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: /j'accepte de participer/i }));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({ action: 'RECORD_STUDENT_ASSENT' });
  });
});

describe('ConsentGate — états', () => {
  it('ne redemande rien quand le consentement est déjà acquis', async () => {
    global.fetch = mockFetch('GRANTED') as unknown as typeof fetch;
    render(<ConsentGate audience="PARENT" studentId="stu_1" />);

    expect(await screen.findByText(/consentement est enregistré/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  /** Hors allowlist, l'API répond 404 : l'écran ne doit rien révéler du dossier. */
  it('reste discret quand le parcours n’est pas accessible', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
    render(<ConsentGate audience="PARENT" studentId="stu_1" />);

    expect(await screen.findByText(/n'est pas accessible avec ce compte/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
