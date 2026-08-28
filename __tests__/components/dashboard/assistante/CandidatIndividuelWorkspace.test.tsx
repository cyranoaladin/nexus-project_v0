/**
 * T3A — STAFF HEADCOUNT WORKFLOW (lot direction-decisions-commercial-
 * governance.md, commit 4ffaac8ed). Proves the per-subject
 * confirmedHeadcountBySubject UI added to CandidatIndividuelWorkspace
 * (the real staff surface that already creates draft Quotes — no second,
 * parallel workspace built for this):
 *   - one headcount field per GROUPE-modality scenario line, business
 *     label only (never a technical subjectId shown to staff);
 *   - independent per-subject entry (never a shared/global value);
 *   - never a fabricated default of 3;
 *   - invalid input (0/negative/fractional) rejected with a field-
 *     associated error, blocking submission;
 *   - a missing headcount for any GROUPE line blocks submission and
 *     explains why (GROUP_PENDING), fail-closed;
 *   - the exact confirmedHeadcountBySubject payload reaches the API.
 */
import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { CandidatIndividuelWorkspace } from '@/components/dashboard/assistante/CandidatIndividuelWorkspace';

const readyResultWithTwoGroupeLines = {
  status: 'READY',
  carte: {},
  validation: { valide: true },
  selection: {},
  diagnosticStatus: 'EXPLOITABLE',
  budgetInsuffisantPourSocle: false,
  modulesNonRepresentables: [],
  scenarios: [
    {
      tier: 'RECOMMANDE',
      lines: [
        { subject: 'pilotage', label: 'Pilotage Nexus', modality: 'PILOTAGE', hoursPerMonth: 0, unitPriceMonthly: 150, priorityScore: Number.MAX_SAFE_INTEGER, priorityLabel: 'haute', reason: 'Socle.' },
        { subject: 'eds1', label: 'Mathématiques', modality: 'GROUPE', hoursPerMonth: 8, unitPriceMonthly: 470, priorityScore: 100, priorityLabel: 'haute', reason: 'Priorité haute (coefficient 16, bilan : a rectifier).' },
        { subject: 'lva', label: 'Anglais LVA', modality: 'GROUPE', hoursPerMonth: 4, unitPriceMonthly: 250, priorityScore: 50, priorityLabel: 'moyenne', reason: 'Priorité moyenne (coefficient 6, bilan : a installer).' },
      ],
      notRecommended: [],
      monthlyTotal: 870,
      grandTotal: 8700,
      months: 10,
      matchedOfferId: null,
      paymentPolicy: 'ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS',
      deposit: 2180,
      lastInstallmentAmount: 850,
    },
  ],
};

interface FetchCall {
  url: string;
  method: string;
  body: unknown;
}

function setupFetchMock(
  opts: {
    simulateResult?: unknown;
    quoteStatus?: number;
    quoteBody?: unknown;
    publishStatus?: number;
    publishBody?: unknown;
    // T5R2 — one entry per successive call to .../family-link; the last
    // entry repeats for any further call. Defaults to a single
    // LINK_ISSUED success.
    familyLinkResponses?: Array<{ status?: number; body?: unknown }>;
  } = {},
): FetchCall[] {
  const calls: FetchCall[] = [];
  const jsonResponse = (body: unknown, status = 200) =>
    Promise.resolve({ ok: status < 400, status, json: async () => body } as unknown as Response);

  let familyLinkCallIndex = 0;

  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });

    if (method === 'GET' && url.endsWith('/api/assistante/candidat-individuel/profils')) {
      return jsonResponse({ profils: [] });
    }
    if (method === 'POST' && url.endsWith('/api/assistante/candidat-individuel/profils')) {
      return jsonResponse({ profil: { id: 'profil-1' } }, 201);
    }
    if (method === 'POST' && url.endsWith('/api/assistante/candidat-individuel/simulate')) {
      return jsonResponse({ result: opts.simulateResult ?? readyResultWithTwoGroupeLines });
    }
    if (method === 'POST' && /\/profils\/profil-1\/quote$/.test(url)) {
      return jsonResponse(
        opts.quoteBody ?? { quote: { id: 'quote-1', status: 'DRAFT', regulatoryMaturity: 'LEGACY_ESTIMATE_UNVERIFIED' }, alreadyExisted: false, marginGate: 'MARGIN_OK' },
        opts.quoteStatus ?? 201,
      );
    }
    if (method === 'POST' && /\/quotes\/quote-1\/publish$/.test(url)) {
      return jsonResponse(
        opts.publishBody ?? { quote: { id: 'quote-1', status: 'DRAFT', regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE' }, alreadyPromoted: false },
        opts.publishStatus ?? 200,
      );
    }
    if (method === 'POST' && /\/quotes\/quote-1\/family-link$/.test(url)) {
      const responses = opts.familyLinkResponses ?? [
        { body: { familyUrl: 'https://nexus.test/devis/aaaa000011112222333344445555666677778888999900001111222233334444', action: 'LINK_ISSUED' } },
      ];
      const entry = responses[Math.min(familyLinkCallIndex, responses.length - 1)];
      familyLinkCallIndex += 1;
      return jsonResponse(entry.body, entry.status ?? 200);
    }
    throw new Error(`Unexpected fetch call: ${method} ${url}`);
  }) as unknown as typeof fetch;

  return calls;
}

/**
 * Drives the workspace to a READY simulation with GROUPE lines: save a
 * draft, then simulate. Uses fireEvent.click rather than userEvent.click
 * for this framer-motion-backed Button — userEvent's full pointer-event
 * sequence does not reliably reach its onClick handler under jsdom,
 * empirically verified against this exact component; a plain click event
 * does. userEvent is still used for realistic keystroke/tab simulation on
 * the inputs below, where it works correctly.
 */
async function reachReadySimulation() {
  render(<CandidatIndividuelWorkspace />);
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Enregistrer le brouillon' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Lancer la simulation' }));
  await screen.findByText('RECOMMANDE', { selector: 'p' });
}

describe('CandidatIndividuelWorkspace — group headcount panel (T3A)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('affiche un champ effectif par ligne GROUPE, avec le libellé métier — jamais l\'identifiant technique du sujet', async () => {
    setupFetchMock();
    await reachReadySimulation();

    expect(screen.getByLabelText('Mathématiques — effectif confirmé')).toBeInTheDocument();
    expect(screen.getByLabelText('Anglais LVA — effectif confirmé')).toBeInTheDocument();
    // The PILOTAGE line never needs a headcount — no field for it.
    expect(screen.queryByLabelText('Pilotage Nexus — effectif confirmé')).not.toBeInTheDocument();
    expect(screen.queryByText('eds1')).not.toBeInTheDocument();
    expect(screen.queryByText('lva')).not.toBeInTheDocument();
  });

  test('aucune valeur n\'est présumée — chaque champ démarre vide, jamais préempli à 3', async () => {
    setupFetchMock();
    await reachReadySimulation();

    expect(screen.getByLabelText('Mathématiques — effectif confirmé')).toHaveValue(null);
    expect(screen.getByLabelText('Anglais LVA — effectif confirmé')).toHaveValue(null);
  });

  test('saisie indépendante par matière — remplir un champ ne modifie pas l\'autre', async () => {
    setupFetchMock();
    await reachReadySimulation();

    await userEvent.type(screen.getByLabelText('Mathématiques — effectif confirmé'), '3');
    expect(screen.getByLabelText('Mathématiques — effectif confirmé')).toHaveValue(3);
    expect(screen.getByLabelText('Anglais LVA — effectif confirmé')).toHaveValue(null);
  });

  test('un effectif invalide (0) affiche une erreur associée au bon champ (aria-describedby) et bloque la création du devis', async () => {
    setupFetchMock();
    await reachReadySimulation();

    const eds1Field = screen.getByLabelText('Mathématiques — effectif confirmé');
    await userEvent.type(eds1Field, '0');
    await userEvent.type(screen.getByLabelText('Anglais LVA — effectif confirmé'), '2');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Mathématiques/);
    expect(eds1Field).toHaveAttribute('aria-invalid', 'true');
    expect(eds1Field.getAttribute('aria-describedby')).toBe(alert.id);

    expect(screen.getByRole('button', { name: /créer un brouillon de devis/i })).toBeDisabled();
  });

  test('un effectif manquant pour une matière bloque tout le devis (GROUP_PENDING) et explique pourquoi', async () => {
    setupFetchMock();
    await reachReadySimulation();

    await userEvent.type(screen.getByLabelText('Mathématiques — effectif confirmé'), '3');
    // Anglais LVA left empty.

    const banner = await screen.findByRole('status');
    expect(banner).toHaveTextContent(/Anglais LVA/);
    expect(banner).toHaveTextContent(/jamais présupposé à 3/i);
    expect(screen.getByRole('button', { name: /créer un brouillon de devis/i })).toBeDisabled();
  });

  test('une fois tous les effectifs GROUPE valides, le payload confirmedHeadcountBySubject envoyé est exact', async () => {
    const calls = setupFetchMock();
    await reachReadySimulation();

    await userEvent.type(screen.getByLabelText('Mathématiques — effectif confirmé'), '3');
    await userEvent.type(screen.getByLabelText('Anglais LVA — effectif confirmé'), '2');

    const createButton = screen.getByRole('button', { name: /créer un brouillon de devis/i });
    expect(createButton).toBeEnabled();
    fireEvent.click(createButton);

    await screen.findByText(/devis brouillon créé/i);

    const quoteCall = calls.find((c) => c.method === 'POST' && /\/profils\/profil-1\/quote$/.test(c.url));
    expect(quoteCall).toBeDefined();
    expect(quoteCall!.body).toMatchObject({
      scenarioTier: 'RECOMMANDE',
      confirmedHeadcountBySubject: { eds1: 3, lva: 2 },
    });
  });

  test('un scénario sans ligne GROUPE (P11-shaped/Pilotage-only) n\'affiche aucun panneau d\'effectif et laisse le bouton de création utilisable', async () => {
    setupFetchMock({
      simulateResult: {
        status: 'READY',
        carte: {},
        validation: { valide: true },
        selection: {},
        diagnosticStatus: 'ABSENT',
        budgetInsuffisantPourSocle: false,
        modulesNonRepresentables: [],
        scenarios: [
          {
            tier: 'RECOMMANDE',
            lines: [{ subject: 'pilotage', label: 'Pilotage Nexus', modality: 'PILOTAGE', hoursPerMonth: 0, unitPriceMonthly: 150, priorityScore: Number.MAX_SAFE_INTEGER, priorityLabel: 'haute', reason: 'Socle.' }],
            notRecommended: [],
            monthlyTotal: 150,
            grandTotal: 1500,
            months: 10,
            matchedOfferId: null,
            paymentPolicy: 'ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS',
            deposit: 380,
            lastInstallmentAmount: 130,
          },
        ],
      },
    });
    await reachReadySimulation();

    expect(screen.queryByTestId('group-headcount-panel')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /créer un brouillon de devis/i })).toBeEnabled();
  });

  test('navigation clavier : Tab atteint chaque champ effectif dans l\'ordre du document', async () => {
    setupFetchMock();
    await reachReadySimulation();

    const eds1Field = screen.getByLabelText('Mathématiques — effectif confirmé');
    const lvaField = screen.getByLabelText('Anglais LVA — effectif confirmé');

    eds1Field.focus();
    expect(eds1Field).toHaveFocus();
    await userEvent.tab();
    expect(lvaField).toHaveFocus();
  });
});

describe('CandidatIndividuelWorkspace — publication famille (T5R RECETTE_FINDING_3)', () => {
  async function createDraftQuote(calls: FetchCall[]) {
    await reachReadySimulation();
    await userEvent.type(screen.getByLabelText('Mathématiques — effectif confirmé'), '3');
    await userEvent.type(screen.getByLabelText('Anglais LVA — effectif confirmé'), '2');
    fireEvent.click(screen.getByRole('button', { name: /créer un brouillon de devis/i }));
    await screen.findByText(/devis brouillon créé/i);
    return calls;
  }

  test('un devis fraîchement créé (LEGACY_ESTIMATE_UNVERIFIED) affiche le bouton "Valider et rendre disponible à la famille"', async () => {
    const calls = setupFetchMock();
    await createDraftQuote(calls);
    expect(screen.getByRole('button', { name: /valider et rendre disponible à la famille/i })).toBeEnabled();
  });

  test('cliquer le bouton appelle POST .../quotes/:id/publish et met à jour l\'affichage de la maturité réglementaire, sans jamais modifier la DB directement depuis le client', async () => {
    const calls = setupFetchMock();
    await createDraftQuote(calls);

    fireEvent.click(screen.getByRole('button', { name: /valider et rendre disponible à la famille/i }));
    await waitFor(() => expect(screen.getByText(/CARTE_VALIDATED_DEFINITIVE/)).toBeInTheDocument());

    const publishCall = calls.find((c) => c.method === 'POST' && /\/quotes\/quote-1\/publish$/.test(c.url));
    expect(publishCall).toBeDefined();
    // Bouton disparaît une fois le devis promu — rien à re-publier.
    expect(screen.queryByRole('button', { name: /valider et rendre disponible à la famille/i })).not.toBeInTheDocument();
  });

  test('une publication refusée par le serveur (422) affiche les raisons, sans jamais présumer un succès côté client', async () => {
    const calls = setupFetchMock({
      publishStatus: 422,
      publishBody: { error: 'Devis non éligible à la publication famille', reasons: ['snapshotRegles.margin.gate == BLOCKED'] },
    });
    await createDraftQuote(calls);

    fireEvent.click(screen.getByRole('button', { name: /valider et rendre disponible à la famille/i }));
    await screen.findByText(/snapshotRegles\.margin\.gate == BLOCKED/);
    // Le bouton reste visible — la promotion a échoué, rien n'a changé côté serveur.
    expect(screen.getByRole('button', { name: /valider et rendre disponible à la famille/i })).toBeEnabled();
  });
});

describe('CandidatIndividuelWorkspace — distribution du lien famille (T5R2 FAMILY_LINK_DISTRIBUTION)', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  async function createAndPublishQuote(calls: FetchCall[]) {
    await reachReadySimulation();
    await userEvent.type(screen.getByLabelText('Mathématiques — effectif confirmé'), '3');
    await userEvent.type(screen.getByLabelText('Anglais LVA — effectif confirmé'), '2');
    fireEvent.click(screen.getByRole('button', { name: /créer un brouillon de devis/i }));
    await screen.findByText(/devis brouillon créé/i);
    fireEvent.click(screen.getByRole('button', { name: /valider et rendre disponible à la famille/i }));
    await waitFor(() => expect(screen.getByText(/CARTE_VALIDATED_DEFINITIVE/)).toBeInTheDocument());
    return calls;
  }

  test('un devis publié affiche le bouton "Générer le lien famille"', async () => {
    const calls = setupFetchMock();
    await createAndPublishQuote(calls);
    expect(screen.getByRole('button', { name: /générer le lien famille/i })).toBeEnabled();
  });

  test('cliquer "Générer le lien famille" appelle POST .../quotes/:id/family-link et affiche l\'URL complète avec un bouton "Copier le lien" — jamais le token exposé séparément de l\'URL', async () => {
    const calls = setupFetchMock();
    await createAndPublishQuote(calls);

    fireEvent.click(screen.getByRole('button', { name: /générer le lien famille/i }));
    const urlField = await screen.findByDisplayValue(/^https:\/\/nexus\.test\/devis\/[0-9a-f]{64}$/);
    expect(urlField).toBeInTheDocument();

    const familyLinkCall = calls.find((c) => c.method === 'POST' && /\/quotes\/quote-1\/family-link$/.test(c.url));
    expect(familyLinkCall).toBeDefined();

    // Le token brut n'apparaît nulle part ailleurs dans le document que
    // dans ce champ URL (jamais affiché seul, jamais dans un autre nœud).
    const rawToken = (urlField as HTMLInputElement).value.split('/').pop()!;
    const bodyHtml = document.body.innerHTML;
    const occurrences = bodyHtml.split(rawToken).length - 1;
    expect(occurrences).toBe(1);
  });

  test('copier le lien déclenche navigator.clipboard.writeText avec l\'URL complète et affiche une confirmation', async () => {
    const calls = setupFetchMock();
    await createAndPublishQuote(calls);
    fireEvent.click(screen.getByRole('button', { name: /générer le lien famille/i }));
    await screen.findByDisplayValue(/^https:\/\/nexus\.test\/devis\//);

    fireEvent.click(screen.getByRole('button', { name: /copier le lien/i }));
    await screen.findByRole('button', { name: /copié/i });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/nexus\.test\/devis\/[0-9a-f]{64}$/),
    );
  });

  test('après un premier lien émis, le bouton devient "Renouveler le lien famille" avec un avertissement explicite', async () => {
    const calls = setupFetchMock({
      familyLinkResponses: [
        { body: { familyUrl: 'https://nexus.test/devis/1111111111111111111111111111111111111111111111111111111111111111', action: 'LINK_ISSUED' } },
      ],
    });
    await createAndPublishQuote(calls);
    fireEvent.click(screen.getByRole('button', { name: /générer le lien famille/i }));
    await screen.findByDisplayValue(/^https:\/\/nexus\.test\/devis\//);

    expect(screen.getByRole('button', { name: /renouveler le lien famille/i })).toBeEnabled();
    expect(screen.getByText(/le lien précédent ne fonctionnera plus/i)).toBeInTheDocument();
  });

  test('renouveler le lien remplace l\'URL affichée par le nouveau lien (action=LINK_ROTATED)', async () => {
    const calls = setupFetchMock({
      familyLinkResponses: [
        { body: { familyUrl: 'https://nexus.test/devis/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', action: 'LINK_ISSUED' } },
        { body: { familyUrl: 'https://nexus.test/devis/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', action: 'LINK_ROTATED' } },
      ],
    });
    await createAndPublishQuote(calls);

    fireEvent.click(screen.getByRole('button', { name: /générer le lien famille/i }));
    await screen.findByDisplayValue(/devis\/aaaa/);

    fireEvent.click(screen.getByRole('button', { name: /renouveler le lien famille/i }));
    await screen.findByDisplayValue(/devis\/bbbb/);
    expect(screen.queryByDisplayValue(/devis\/aaaa/)).not.toBeInTheDocument();

    const familyLinkCalls = calls.filter((c) => c.method === 'POST' && /\/quotes\/quote-1\/family-link$/.test(c.url));
    expect(familyLinkCalls).toHaveLength(2);
  });

  test('une émission refusée par le serveur (422) affiche les raisons, sans jamais présumer un succès côté client', async () => {
    const calls = setupFetchMock({
      familyLinkResponses: [{ status: 422, body: { error: 'Lien famille non émis', reasons: ['total commercial <= 0'] } }],
    });
    await createAndPublishQuote(calls);

    fireEvent.click(screen.getByRole('button', { name: /générer le lien famille/i }));
    await screen.findByText(/total commercial <= 0/);
    expect(screen.queryByDisplayValue(/^https:\/\/nexus\.test\/devis\//)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /générer le lien famille/i })).toBeEnabled();
  });
});
