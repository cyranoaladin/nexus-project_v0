import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

const staffQuote = {
  id: 'quote-1',
  statusLabel: 'Brouillon interne',
  updatedAt: '2026-08-29T10:00:00.000Z',
  totals: {
    annualTnd: 9600,
    depositTnd: 2400,
    installmentTnd: 720,
    installmentCount: 10,
  },
  lines: [
    { subject: 'Mathématiques', modality: 'Individuel', hoursPerMonth: 4, monthlyAmountTnd: 720 },
    { subject: 'Pilotage Nexus', modality: 'Pilotage Nexus', hoursPerMonth: null, monthlyAmountTnd: 150 },
  ],
  margin: { percentage: 45, statusLabel: 'Marge conforme' },
  actions: {
    canPublish: true,
    canIssueFamilyLink: false,
    canRotateFamilyLink: false,
    canDownloadPdf: true,
    canCreateRevision: true,
    hasFamilyLink: false,
  },
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
  quote?: MockResponse | Array<MockResponse | Error>;
  publish?: MockResponse;
  family?: MockResponse;
  profiles?: unknown[];
  profile?: unknown;
  profilesById?: Record<string, unknown>;
  revision?: MockResponse;
  reconcile?: MockResponse;
  profileIds?: string[];
} = {}) {
  let quoteCallCount = 0;
  let profileCreateCount = 0;
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';

    if (url === '/api/assistante/candidat-individuel/profils' && method === 'GET') {
      return jsonResponse({ body: { profils: overrides.profiles ?? [] } });
    }
    if (url.startsWith('/api/quotes/leads/search')) {
      return jsonResponse({ body: { leads: [lead] } });
    }
    if (url.startsWith('/api/assistante/students?')) {
      return jsonResponse({ body: { students: [student] } });
    }
    if (url === '/api/assistante/candidat-individuel/profils' && method === 'POST') {
      const ids = overrides.profileIds ?? ['profil-1'];
      const id = ids[Math.min(profileCreateCount++, ids.length - 1)];
      return jsonResponse({ body: { profil: { id } }, status: 201 });
    }
    const profileMatch = url.match(/\/api\/assistante\/candidat-individuel\/profils\/(profil-[^/]+)$/);
    if (profileMatch && method === 'GET') {
      return jsonResponse({ body: { profil: overrides.profilesById?.[profileMatch[1]] ?? overrides.profile } });
    }
    if (url === '/api/assistante/candidat-individuel/profils/profil-1/revision' && method === 'POST') {
      return jsonResponse(overrides.revision ?? { body: { profil: overrides.profile }, status: 201 });
    }
    if (url === '/api/assistante/candidat-individuel/simulate') {
      return jsonResponse(overrides.simulate ?? { body: { result: readyResult } });
    }
    if (/\/profils\/profil-[^/]+\/quote\/reconcile$/.test(url) && method === 'POST') {
      return jsonResponse(overrides.reconcile ?? { ok: false, status: 404, body: { error: 'Aucun devis ne correspond à cette tentative.' } });
    }
    if (/\/profils\/profil-[^/]+\/quote$/.test(url)) {
      const configured = Array.isArray(overrides.quote)
        ? overrides.quote[Math.min(quoteCallCount++, overrides.quote.length - 1)]
        : overrides.quote;
      if (configured instanceof Error) throw configured;
      return jsonResponse(configured ?? { body: { quote: staffQuote }, status: 201 });
    }
    if (url.endsWith('/quotes/quote-1/publish')) {
      return jsonResponse(overrides.publish ?? {
        body: {
          quote: {
            ...staffQuote,
            statusLabel: 'Validé pour la famille',
            actions: { ...staffQuote.actions, canPublish: false, canIssueFamilyLink: true },
          },
        },
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

  test('invalide immédiatement le devis si l’effectif exact est modifié ou effacé', async () => {
    installFetchRouter();
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);

    const mathsCard = screen.getByRole('article', { name: 'Mathématiques' });
    await user.click(within(mathsCard).getByRole('button', { name: 'Petit groupe' }));
    await user.type(within(mathsCard).getByLabelText("Nombre exact d'élèves confirmés"), '3');
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));
    await screen.findByRole('heading', { name: 'Synthèse du devis' });

    await user.click(screen.getByRole('button', { name: 'Besoins' }));
    const exactSize = screen.getByLabelText("Nombre exact d'élèves confirmés");
    await user.clear(exactSize);
    await user.type(exactSize, '4');

    expect(screen.queryByRole('button', { name: 'Valider et publier' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Télécharger le PDF' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Besoins et accompagnements' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '5 Devis' })).toBeDisabled();
  });

  test('utilise les lignes persistées et repricées du DTO staff dans la synthèse', async () => {
    installFetchRouter();
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);

    const mathsCard = screen.getByRole('article', { name: 'Mathématiques' });
    await user.click(within(mathsCard).getByRole('button', { name: 'Individuel' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));

    const summary = await screen.findByRole('region', { name: 'Lignes du devis serveur' });
    expect(within(summary).getByText('Individuel')).toBeInTheDocument();
    expect(within(summary).getByText('720 TND / mois')).toBeInTheDocument();
    expect(within(summary).queryByText('Petit groupe')).not.toBeInTheDocument();
    expect(within(summary).queryByText('250 TND / mois')).not.toBeInTheDocument();
  });

  test('demande un motif pour une marge à revoir et ne propose jamais d’override bloqué', async () => {
    installFetchRouter({
      quote: [
        {
          ok: false,
          status: 422,
          body: {
            error: 'Validation explicite requise',
            marginReview: { percentage: 35, statusLabel: 'Validation de la marge requise', canOverride: true },
          },
        },
        { body: { quote: { ...staffQuote, margin: { percentage: 35, statusLabel: 'Marge validée par le staff' } } }, status: 201 },
      ],
    });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);
    await user.click(within(screen.getByRole('article', { name: 'Mathématiques' })).getByRole('button', { name: 'Duo' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));

    expect(await screen.findByText('35 %')).toBeInTheDocument();
    const reason = screen.getByLabelText('Motif de validation de la marge');
    expect(screen.getByRole('button', { name: 'Valider la marge et générer' })).toBeDisabled();
    await user.type(reason, 'Validation commerciale par la direction');
    await user.click(screen.getByRole('button', { name: 'Valider la marge et générer' }));

    await screen.findByRole('heading', { name: 'Synthèse du devis' });
    const quoteCalls = (global.fetch as jest.Mock).mock.calls.filter(([url]) => String(url).endsWith('/profils/profil-1/quote'));
    expect(JSON.parse(quoteCalls[1][1].body).marginOverride).toEqual({ reason: 'Validation commerciale par la direction' });

  });

  test('ne propose aucun contournement quand la marge est bloquée', async () => {
    installFetchRouter({
      quote: {
        ok: false,
        status: 422,
        body: { error: 'Proposition bloquée', marginReview: { percentage: 22, statusLabel: 'Proposition bloquée', canOverride: false } },
      },
    });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);
    await user.click(within(screen.getByRole('article', { name: 'Mathématiques' })).getByRole('button', { name: 'Duo' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));

    expect(await screen.findByText('22 %')).toBeInTheDocument();
    expect(screen.getByText(/ne peut pas être validée/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Motif de validation de la marge')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Valider la marge et générer' })).not.toBeInTheDocument();
  });

  test('contraint les spécialités, les langues et construit les dispenses depuis des contrôles dédiés', async () => {
    installFetchRouter();
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await selectIdentity(user);
    await user.click(screen.getByRole('button', { name: 'Continuer vers le profil' }));

    const specialty = screen.getByLabelText('Première spécialité poursuivie');
    expect(within(specialty).queryByRole('option', { name: 'Français' })).not.toBeInTheDocument();
    expect(within(specialty).queryByRole('option', { name: /maths expertes/i })).not.toBeInTheDocument();
    const language = screen.getByLabelText('Langue vivante A', { selector: 'select' });
    expect(within(language).getAllByRole('option')).toHaveLength(3);
    expect(within(language).queryByRole('option', { name: 'Mathématiques' })).not.toBeInTheDocument();

    expect(screen.getByLabelText('Dispense - Philosophie')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Dispense - Philosophie'));
    await user.selectOptions(screen.getByLabelText('Statut de la dispense - Philosophie'), 'CONFIRMEE');
    await user.type(screen.getByLabelText('Référence du justificatif - Philosophie'), 'doc-verifie-1');
    await user.click(screen.getByRole('button', { name: 'Enregistrer et simuler' }));

    const simulateCall = (global.fetch as jest.Mock).mock.calls.find(([url]) => url === '/api/assistante/candidat-individuel/simulate');
    const payload = JSON.parse(simulateCall[1].body);
    expect(payload.staffExtension.dispensesDeclarees).toEqual([
      { epreuveId: 'philosophie', statut: 'CONFIRMEE', justificatifRef: 'doc-verifie-1' },
    ]);
  });

  test('reprend le dernier devis curaté sans dupliquer ni prétendre retrouver le lien brut', async () => {
    const profile = {
      id: 'profil-1',
      level: 'TERMINALE',
      examSession: 2027,
      modalite: 'A',
      specialite1: 'MATHEMATIQUES',
      specialite2: 'NSI',
      specialiteAbandonnee: null,
      langueA: 'ANGLAIS',
      langueB: 'ESPAGNOL',
      optionsTerminale: [],
      estRedoublant: false,
      estTitulaireBacDejaObtenu: false,
      changementSpecialite: false,
      intentionAmelioration: false,
      intentionCycleComplet: true,
      moyenneRattrapage: null,
      etalementPlurisessionsDeclare: false,
      brancheBascule: null,
      contactLead: lead,
      student,
      lastQuote: {
        ...staffQuote,
        statusLabel: 'Validé pour la famille',
        actions: { ...staffQuote.actions, canPublish: false, canIssueFamilyLink: true, canRotateFamilyLink: true, hasFamilyLink: true },
      },
    };
    installFetchRouter({ profiles: [profile], profile });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);

    await user.click(screen.getByText('Dossiers récents'));
    await user.click(await screen.findByRole('button', { name: /yasmine ben salah/i }));

    expect(await screen.findByRole('heading', { name: 'Synthèse du devis' })).toBeInTheDocument();
    expect(screen.getAllByRole('region', { name: 'Lignes du devis serveur' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Renouveler le lien famille' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Lien famille sécurisé')).not.toBeInTheDocument();
    expect(screen.getByText(/le lien existant n'est pas réaffichable/i)).toBeInTheDocument();
  });

  test('réutilise la même clé idempotente après un échec réseau puis la renouvelle après succès et changement commercial', async () => {
    installFetchRouter({ quote: [new Error('network'), { body: { quote: staffQuote }, status: 201 }, { body: { quote: staffQuote }, status: 201 }] });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);
    await user.click(within(screen.getByRole('article', { name: 'Mathématiques' })).getByRole('button', { name: 'Individuel' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));
    expect(await screen.findByText(/résultat de la création est inconnu/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Réessayer exactement' }));
    await screen.findByRole('heading', { name: 'Synthèse du devis' });

    await user.click(screen.getByRole('button', { name: 'Besoins' }));
    await user.click(within(screen.getByRole('article', { name: 'Mathématiques' })).getByRole('button', { name: 'Duo' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));

    const quoteCalls = (global.fetch as jest.Mock).mock.calls.filter(([url]) => String(url).endsWith('/profils/profil-1/quote'));
    const keys = quoteCalls.map(([, init]) => JSON.parse(init.body).idempotencyKey);
    expect(keys[0]).toBe(keys[1]);
    expect(quoteCalls[0][1].body).toBe(quoteCalls[1][1].body);
    expect(keys[2]).not.toBe(keys[1]);
  });

  test('ne propose pas un second POST après succès tant que le profil et le fingerprint sont inchangés', async () => {
    installFetchRouter();
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);
    await user.click(within(screen.getByRole('article', { name: 'Mathématiques' })).getByRole('button', { name: 'Individuel' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));
    await screen.findByRole('heading', { name: 'Synthèse du devis' });

    await user.click(screen.getByRole('button', { name: 'Financement' }));
    expect(screen.queryByRole('button', { name: 'Générer le devis' })).not.toBeInTheDocument();
    expect((global.fetch as jest.Mock).mock.calls.filter(([url]) => /\/profils\/profil-1\/quote$/.test(String(url)))).toHaveLength(1);
  });

  test('renouvelle la clé si un nouveau profil porte les mêmes faits commerciaux', async () => {
    installFetchRouter({ profileIds: ['profil-1', 'profil-2'], quote: [new Error('network lost'), { body: { quote: staffQuote }, status: 201 }] });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);
    await user.click(within(screen.getByRole('article', { name: 'Mathématiques' })).getByRole('button', { name: 'Individuel' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));
    await screen.findByText(/résultat de la création est inconnu/i);

    await user.click(screen.getByRole('button', { name: 'Nouveau' }));
    await reachModules(user);
    await user.click(within(screen.getByRole('article', { name: 'Mathématiques' })).getByRole('button', { name: 'Individuel' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));

    const calls = (global.fetch as jest.Mock).mock.calls.filter(([url]) => /\/profils\/profil-[^/]+\/quote$/.test(String(url)));
    expect(JSON.parse(calls[0][1].body).idempotencyKey).not.toBe(JSON.parse(calls[1][1].body).idempotencyKey);
  });

  test('verrouille les éditions après erreur ambiguë puis rejoue exactement le même motif, la même clé et le même body', async () => {
    installFetchRouter({
      quote: [
        { ok: false, status: 422, body: { error: 'Validation explicite requise', marginReview: { percentage: 35, statusLabel: 'Validation de la marge requise', canOverride: true } } },
        new Error('network lost after write'),
        { body: { quote: { ...staffQuote, margin: { percentage: 35, statusLabel: 'Marge validée par le staff' } } }, status: 201 },
      ],
    });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);
    await user.click(within(screen.getByRole('article', { name: 'Mathématiques' })).getByRole('button', { name: 'Duo' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));
    const reason = await screen.findByLabelText('Motif de validation de la marge');
    await user.type(reason, 'Première validation direction');
    await user.click(screen.getByRole('button', { name: 'Valider la marge et générer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/résultat de la création est inconnu/i);
    expect(screen.queryByLabelText('Motif de validation de la marge')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer exactement' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recharger le dossier' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Étapes du simulateur' })).not.toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Mathématiques' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Modifier le profil' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Notes conservées')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Réessayer exactement' }));

    const calls = (global.fetch as jest.Mock).mock.calls.filter(([url]) => /\/profils\/profil-1\/quote$/.test(String(url)));
    const firstOverride = JSON.parse(calls[1][1].body);
    const replayedOverride = JSON.parse(calls[2][1].body);
    expect(calls[2][1].body).toBe(calls[1][1].body);
    expect(replayedOverride.idempotencyKey).toBe(firstOverride.idempotencyKey);
    expect(firstOverride.marginOverride.reason).toBe('Première validation direction');
    expect(replayedOverride.marginOverride.reason).toBe('Première validation direction');
    expect(calls).toHaveLength(3);
  });

  test('conserve la tentative après un 404 puis rejoue la même clé lorsque la création initiale finit par aboutir', async () => {
    const profile = {
      id: 'profil-1', level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'NSI',
      specialiteAbandonnee: null, langueA: 'ANGLAIS', langueB: 'ESPAGNOL', optionsTerminale: [], estRedoublant: false,
      estTitulaireBacDejaObtenu: false, changementSpecialite: false, intentionAmelioration: false, intentionCycleComplet: true,
      moyenneRattrapage: null, etalementPlurisessionsDeclare: false, brancheBascule: null, contactLead: lead, student, lastQuote: staffQuote,
    };
    installFetchRouter({ quote: [new Error('network lost after write'), { body: { quote: staffQuote }, status: 200 }], profile });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);
    await user.click(within(screen.getByRole('article', { name: 'Mathématiques' })).getByRole('button', { name: 'Individuel' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));
    await screen.findByRole('button', { name: 'Recharger le dossier' });
    await user.click(screen.getByRole('button', { name: 'Recharger le dossier' }));

    expect(await screen.findByText('Aucun devis trouvé pour l’instant; réessayer exactement ou relancer la vérification.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer exactement' })).toBeEnabled();
    expect(screen.queryByRole('heading', { name: 'Synthèse du devis' })).not.toBeInTheDocument();
    expect((global.fetch as jest.Mock).mock.calls.filter(([url, init]) => String(url).endsWith('/profils/profil-1') && (init?.method ?? 'GET') === 'GET')).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Réessayer exactement' }));
    expect(await screen.findByRole('heading', { name: 'Synthèse du devis' })).toBeInTheDocument();
    const createCalls = (global.fetch as jest.Mock).mock.calls.filter(([url]) => /\/profils\/profil-1\/quote$/.test(String(url)));
    expect(createCalls).toHaveLength(2);
    expect(createCalls[1][1].body).toBe(createCalls[0][1].body);
    expect(JSON.parse(createCalls[1][1].body).idempotencyKey).toBe(JSON.parse(createCalls[0][1].body).idempotencyKey);
  });

  test('réconcilie uniquement le devis de la clé idempotente exacte sans second POST de création', async () => {
    installFetchRouter({ quote: [new Error('network lost after write')], reconcile: { body: { quote: staffQuote }, status: 200 } });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);
    await user.click(within(screen.getByRole('article', { name: 'Mathématiques' })).getByRole('button', { name: 'Individuel' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));
    await user.click(await screen.findByRole('button', { name: 'Recharger le dossier' }));

    expect(await screen.findByRole('heading', { name: 'Synthèse du devis' })).toBeInTheDocument();
    const createCall = (global.fetch as jest.Mock).mock.calls.find(([url]) => /\/profils\/profil-1\/quote$/.test(String(url)));
    const reconcileCall = (global.fetch as jest.Mock).mock.calls.find(([url]) => /\/profils\/profil-1\/quote\/reconcile$/.test(String(url)));
    expect(JSON.parse(reconcileCall[1].body).idempotencyKey).toBe(JSON.parse(createCall[1].body).idempotencyKey);
    expect((global.fetch as jest.Mock).mock.calls.filter(([url]) => /\/profils\/profil-1\/quote$/.test(String(url)))).toHaveLength(1);
  });

  test('conserve l’état ambigu après un 201 dont le DTO quote est tronqué puis rejoue le body exact', async () => {
    installFetchRouter({ quote: [{ body: { quote: { id: 'quote-tronquee' } }, status: 201 }, { body: { quote: staffQuote }, status: 201 }] });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);
    await user.click(within(screen.getByRole('article', { name: 'Mathématiques' })).getByRole('button', { name: 'Individuel' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/résultat de la création est inconnu/i);
    expect(screen.queryByRole('heading', { name: 'Synthèse du devis' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Réessayer exactement' }));
    expect(await screen.findByRole('heading', { name: 'Synthèse du devis' })).toBeInTheDocument();
    const calls = (global.fetch as jest.Mock).mock.calls.filter(([url]) => /\/profils\/profil-1\/quote$/.test(String(url)));
    expect(calls[1][1].body).toBe(calls[0][1].body);
  });

  test('restaure un écran de résolution exclusif après Nouveau puis reprise du dossier ambigu', async () => {
    const profile = {
      id: 'profil-1', level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'NSI',
      specialiteAbandonnee: null, langueA: 'ANGLAIS', langueB: 'ESPAGNOL', optionsTerminale: [], estRedoublant: false,
      estTitulaireBacDejaObtenu: false, changementSpecialite: false, intentionAmelioration: false, intentionCycleComplet: true,
      moyenneRattrapage: null, etalementPlurisessionsDeclare: false, brancheBascule: null, contactLead: lead, student, lastQuote: null,
    };
    installFetchRouter({ profiles: [profile], profile, quote: [new Error('network lost after write')] });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);
    await user.click(within(screen.getByRole('article', { name: 'Mathématiques' })).getByRole('button', { name: 'Individuel' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));
    await screen.findByRole('button', { name: 'Réessayer exactement' });
    await user.click(screen.getByRole('button', { name: 'Nouveau' }));
    await user.click(screen.getByText('Dossiers récents'));
    await user.click(await screen.findByRole('button', { name: /yasmine ben salah/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/résultat de la création est inconnu/i);
    expect(screen.queryByRole('heading', { name: 'Profil du candidat' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enregistrer et simuler' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Notes conservées')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer exactement' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Recharger le dossier' })).toBeEnabled();
  });

  test('désactive Nouveau et les dossiers récents avec une explication pendant la réconciliation', async () => {
    let resolveReconcile!: (response: Response) => void;
    const pendingReconcile = new Promise<Response>((resolve) => { resolveReconcile = resolve; });
    const profile = {
      id: 'profil-1', level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'NSI',
      specialiteAbandonnee: null, langueA: 'ANGLAIS', langueB: 'ESPAGNOL', optionsTerminale: [], estRedoublant: false,
      estTitulaireBacDejaObtenu: false, changementSpecialite: false, intentionAmelioration: false, intentionCycleComplet: true,
      moyenneRattrapage: null, etalementPlurisessionsDeclare: false, brancheBascule: null, contactLead: lead, student, lastQuote: null,
    };
    installFetchRouter({ profiles: [profile], quote: [new Error('network lost after write')] });
    const routedFetch = global.fetch as jest.Mock;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => (
      /\/quote\/reconcile$/.test(String(input)) ? pendingReconcile : routedFetch(input, init)
    )) as typeof fetch;
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);
    await user.click(within(screen.getByRole('article', { name: 'Mathématiques' })).getByRole('button', { name: 'Individuel' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));
    await user.click(screen.getByText('Dossiers récents'));
    await user.click(screen.getByRole('button', { name: 'Recharger le dossier' }));

    expect(screen.getByRole('button', { name: 'Nouveau' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Nouveau' })).toHaveAttribute('aria-describedby', 'ambiguous-quote-explanation');
    expect(screen.getByText('Dossiers récents')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: /yasmine ben salah/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /yasmine ben salah/i })).toHaveAttribute('aria-describedby', 'ambiguous-quote-explanation');

    await act(async () => { resolveReconcile(jsonResponse({ ok: false, status: 404, body: {} })); });
  });

  test('ignore la réponse tardive du profil A si une navigation concurrente a chargé le profil B', async () => {
    let resolveReconcile!: (response: Response) => void;
    const pendingReconcile = new Promise<Response>((resolve) => { resolveReconcile = resolve; });
    const profileA = {
      id: 'profil-1', level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'NSI',
      specialiteAbandonnee: null, langueA: 'ANGLAIS', langueB: 'ESPAGNOL', optionsTerminale: [], estRedoublant: false,
      estTitulaireBacDejaObtenu: false, changementSpecialite: false, intentionAmelioration: false, intentionCycleComplet: true,
      moyenneRattrapage: null, etalementPlurisessionsDeclare: false, brancheBascule: null, contactLead: lead, student, lastQuote: null,
    };
    const studentB = { id: 'student-2', user: { firstName: 'Amine', lastName: 'Trabelsi', email: 'amine@example.test' } };
    const profileB = { ...profileA, id: 'profil-2', student: studentB };
    installFetchRouter({ profiles: [profileA, profileB], profilesById: { 'profil-2': profileB }, quote: [new Error('network lost after write')] });
    const routedFetch = global.fetch as jest.Mock;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => (
      /\/quote\/reconcile$/.test(String(input)) ? pendingReconcile : routedFetch(input, init)
    )) as typeof fetch;
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);
    await user.click(within(screen.getByRole('article', { name: 'Mathématiques' })).getByRole('button', { name: 'Individuel' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));
    await user.click(screen.getByText('Dossiers récents'));
    const reconcile = screen.getByRole('button', { name: 'Recharger le dossier' });
    const openProfileB = screen.getByRole('button', { name: /amine trabelsi/i });

    act(() => {
      fireEvent.click(reconcile);
      fireEvent.click(openProfileB);
    });
    expect(await screen.findByText('Amine Trabelsi')).toBeInTheDocument();
    await act(async () => { resolveReconcile(jsonResponse({ body: { quote: staffQuote }, status: 200 })); });

    expect(screen.queryByRole('heading', { name: 'Synthèse du devis' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Profil du candidat' })).toBeInTheDocument();
    expect(screen.getAllByText('Amine Trabelsi').length).toBeGreaterThan(0);
  });

  test('reprend une révision enrichie en conservant les identités et revient au profil sans devis dupliqué', async () => {
    const publishedProfile = {
      id: 'profil-1', level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'NSI',
      specialiteAbandonnee: null, langueA: 'ANGLAIS', langueB: 'ESPAGNOL', optionsTerminale: [], estRedoublant: false,
      estTitulaireBacDejaObtenu: false, changementSpecialite: false, intentionAmelioration: false, intentionCycleComplet: true,
      moyenneRattrapage: null, etalementPlurisessionsDeclare: false, brancheBascule: null, contactLead: lead, student, lastQuote: staffQuote,
    };
    const revision = { ...publishedProfile, id: 'profil-2', previousProfilId: 'profil-1', revisionNumber: 2, lastQuote: null };
    installFetchRouter({ profiles: [publishedProfile], profile: publishedProfile, revision: { body: { profil: revision }, status: 201 } });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await user.click(screen.getByText('Dossiers récents'));
    await user.click(await screen.findByRole('button', { name: /yasmine ben salah/i }));
    await user.click(screen.getByRole('button', { name: 'Créer une révision' }));

    expect(await screen.findByRole('heading', { name: 'Profil du candidat' })).toBeInTheDocument();
    expect(screen.getByText('Sonia Ben Salah')).toBeInTheDocument();
    expect(screen.getAllByText('Yasmine Ben Salah').length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: 'Synthèse du devis' })).not.toBeInTheDocument();
  });

  test('signale une dispense persistée inconnue tout en laissant visibles les contrôles supportés', async () => {
    const profile = {
      id: 'profil-1', level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'NSI',
      specialiteAbandonnee: null, langueA: 'ANGLAIS', langueB: 'ESPAGNOL', optionsTerminale: [], estRedoublant: false,
      estTitulaireBacDejaObtenu: false, changementSpecialite: false, intentionAmelioration: false, intentionCycleComplet: true,
      moyenneRattrapage: null, etalementPlurisessionsDeclare: false, brancheBascule: null, contactLead: lead, student, lastQuote: null,
      dispensesDeclarees: [{ epreuveId: 'UNKNOWN_EXAM', statut: 'CONFIRMEE' }],
    };
    installFetchRouter({ profiles: [profile], profile });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await user.click(screen.getByText('Dossiers récents'));
    await user.click(await screen.findByRole('button', { name: /yasmine ben salah/i }));

    expect(screen.getByLabelText('Dispense - Philosophie')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/dispense inconnue/i);
    await user.click(screen.getByRole('button', { name: 'Enregistrer et simuler' }));
    expect(screen.getAllByRole('alert').some((alert) => /enregistrement est bloqué/i.test(alert.textContent ?? ''))).toBe(true);
  });
});
