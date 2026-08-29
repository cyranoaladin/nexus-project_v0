import '@testing-library/jest-dom';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { CandidatIndividuelWorkspace } from '@/components/dashboard/assistante/CandidatIndividuelWorkspace';

const lead = {
  id: 'lead-1',
  name: 'Sonia Ben Salah',
  email: 'sonia@example.test',
  phone: '+21699111222',
  status: 'NEW',
};

const student = {
  id: 'student-1',
  user: { firstName: 'Yasmine', lastName: 'Ben Salah', email: 'yasmine@example.test' },
};

const readyResult = {
  status: 'READY',
  diagnosticStatus: 'ABSENT',
  budgetInsuffisantPourSocle: false,
  modulesNonRepresentables: [],
  validation: { emissionAutomatiqueAutorisee: true, necessiteVerificationHumaine: false },
  carte: { parcours: { labelFamille: 'Candidat individuel - parcours sur deux ans' } },
  selection: {},
  scenarios: [
    {
      tier: 'RECOMMANDE',
      lines: [
        {
          subject: 'eds1',
          label: 'Mathématiques',
          modality: 'GROUPE',
          hoursPerMonth: 4,
          unitPriceMonthly: 250,
          priorityScore: 100,
          priorityLabel: 'haute',
          reason: 'Accompagnement recommandé',
        },
        {
          subject: 'pilotage',
          label: 'Pilotage Nexus',
          modality: 'PILOTAGE',
          hoursPerMonth: null,
          unitPriceMonthly: 150,
          priorityScore: 100,
          priorityLabel: 'haute',
          reason: 'Suivi du parcours',
        },
      ],
      notRecommended: [],
      monthlyTotal: 300,
      grandTotal: 4000,
      months: 10,
      matchedOfferId: null,
      paymentPolicy: 'ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS',
      deposit: 1000,
      lastInstallmentAmount: 300,
    },
  ],
};

type MockResponse = { ok?: boolean; status?: number; body: unknown };

function jsonResponse(response: MockResponse): Response {
  return {
    ok: response.ok ?? true,
    status: response.status ?? (response.ok === false ? 422 : 200),
    json: async () => response.body,
  } as Response;
}

function installFetchRouter(overrides: {
  simulate?: MockResponse;
  quote?: MockResponse;
  publish?: MockResponse;
  family?: MockResponse;
} = {}) {
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';

    if (url === '/api/assistante/candidat-individuel/profils' && method === 'GET') {
      return jsonResponse({ body: { profils: [] } });
    }
    if (url.startsWith('/api/quotes/leads/search')) {
      return jsonResponse({ body: { leads: [lead] } });
    }
    if (url.startsWith('/api/assistante/students?')) {
      return jsonResponse({ body: { students: [student] } });
    }
    if (url === '/api/assistante/candidat-individuel/profils' && method === 'POST') {
      return jsonResponse({ body: { profil: { id: 'profil-1' } }, status: 201 });
    }
    if (url === '/api/assistante/candidat-individuel/simulate') {
      return jsonResponse(overrides.simulate ?? { body: { result: readyResult } });
    }
    if (url.endsWith('/profils/profil-1/quote')) {
      return jsonResponse(overrides.quote ?? {
        body: {
          quote: {
            id: 'quote-1',
            status: 'DRAFT',
            regulatoryMaturity: 'LEGACY_ESTIMATE_UNVERIFIED',
            monthlyTotal: 720,
            grandTotal: 9600,
            deposit: 2400,
          },
          marginGate: 'MARGIN_OK',
        },
        status: 201,
      });
    }
    if (url.endsWith('/quotes/quote-1/publish')) {
      return jsonResponse(overrides.publish ?? {
        body: { quote: { id: 'quote-1', status: 'DRAFT', regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE' } },
      });
    }
    if (url.endsWith('/quotes/quote-1/family-link')) {
      return jsonResponse(overrides.family ?? {
        body: { familyUrl: 'https://example.test/devis/raw-session-token', action: 'LINK_ISSUED' },
      });
    }
    throw new Error(`Unexpected fetch: ${method} ${url}`);
  }) as typeof fetch;
}

async function selectIdentity(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Rechercher un responsable'), 'sonia');
  await user.click(await screen.findByRole('option', { name: /sonia ben salah/i }));
  await user.type(screen.getByLabelText('Rechercher un élève'), 'yasmine');
  await user.click(await screen.findByRole('option', { name: /yasmine ben salah/i }));
}

async function reachModules(user: ReturnType<typeof userEvent.setup>) {
  await selectIdentity(user);
  await user.click(screen.getByRole('button', { name: 'Continuer vers le profil' }));
  await user.click(screen.getByRole('button', { name: 'Enregistrer et simuler' }));
  await screen.findByRole('heading', { name: 'Besoins et accompagnements' });
}

describe('CandidatIndividuelWorkspace', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('présente un assistant progressif, accessible et sans identifiants techniques', async () => {
    installFetchRouter();
    render(<CandidatIndividuelWorkspace />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/assistante/candidat-individuel/profils'));

    expect(screen.getByRole('navigation', { name: 'Étapes du simulateur' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Élève et responsable' })).toBeInTheDocument();
    expect(screen.getByLabelText('Rechercher un responsable')).toHaveAttribute('aria-autocomplete', 'list');
    expect(screen.getByLabelText('Rechercher un élève')).toHaveAttribute('aria-autocomplete', 'list');
    expect(screen.queryByText(/identifiant manuellement/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/MOD_|P\d+_/)).not.toBeInTheDocument();

    const advanced = screen.getByText('Options avancées').closest('details');
    expect(advanced).not.toHaveAttribute('open');
    expect(screen.getByRole('button', { name: 'Continuer vers le profil' })).toBeDisabled();
  });

  test('recherche puis sélectionne le responsable et l’élève sans demander leurs IDs', async () => {
    installFetchRouter();
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);

    await selectIdentity(user);

    expect(screen.getAllByText(/sonia ben salah/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/yasmine ben salah/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Continuer vers le profil' })).toBeEnabled();
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/quotes/leads/search?q=sonia'));
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/assistante/students?search=yasmine'));
  });

  test('lie les contrôles Individuel/Duo/Petit groupe au confirmedHeadcount sans inventer 3', async () => {
    installFetchRouter();
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);

    const mathsCard = screen.getByRole('article', { name: 'Mathématiques' });
    expect(within(mathsCard).getByText('4 h / mois')).toBeInTheDocument();
    expect(within(mathsCard).getByText('250 TND / mois')).toBeInTheDocument();
    expect(within(mathsCard).getByRole('button', { name: 'Individuel' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(mathsCard).getByRole('button', { name: 'Duo' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(mathsCard).getByRole('button', { name: 'Petit groupe' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/groupe de mathématiques n'est pas encore confirmé/i)).toBeInTheDocument();

    await user.click(within(mathsCard).getByRole('button', { name: 'Individuel' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    expect(screen.getByText('À recalculer par le serveur')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));

    expect((await screen.findAllByText('9 600 TND')).length).toBeGreaterThan(0);
    const quoteCall = (global.fetch as jest.Mock).mock.calls.find(([url]) => String(url).endsWith('/profils/profil-1/quote'));
    const quoteBody = JSON.parse(quoteCall[1].body);
    expect(quoteBody.confirmedHeadcountBySubject).toEqual({ eds1: 1 });
  });

  test('humanise les blocages serveur sans exposer les codes internes', async () => {
    installFetchRouter({
      simulate: {
        body: {
          result: {
            status: 'DIRECTION_APPROVAL_REQUIRED',
            pendingModuleIds: ['MOD_DGEMC'],
            pendingServiceIds: [],
          },
        },
      },
    });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);

    await selectIdentity(user);
    await user.click(screen.getByRole('button', { name: 'Continuer vers le profil' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer et simuler' }));

    expect(await screen.findByText("Cette option n'est pas disponible dans l'offre V1.")).toBeInTheDocument();
    expect(screen.queryByText('MOD_DGEMC')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Générer le devis' })).not.toBeInTheDocument();
  });

  test('n’affiche publication, lien famille et PDF que lorsque chaque action est possible', async () => {
    installFetchRouter();
    const user = userEvent.setup();
    const clipboardWrite = jest.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);

    const mathsCard = screen.getByRole('article', { name: 'Mathématiques' });
    await user.click(within(mathsCard).getByRole('button', { name: 'Duo' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    expect(screen.queryByRole('button', { name: 'Valider et publier' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));
    expect(await screen.findByRole('heading', { name: 'Synthèse du devis' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Télécharger le PDF' })).toHaveAttribute(
      'href',
      '/api/assistante/candidat-individuel/quotes/quote-1/pdf',
    );
    expect(screen.getByText('Marge conforme')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Valider et publier' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Créer le lien famille' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Valider et publier' }));
    await user.click(await screen.findByRole('button', { name: 'Créer le lien famille' }));
    expect(await screen.findByLabelText('Lien famille sécurisé')).toHaveValue('https://example.test/devis/raw-session-token');
    expect(screen.queryByText(/marginPct|costPolicy|snapshotRegles/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Copier le lien' }));
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith('https://example.test/devis/raw-session-token'));
  });
});
