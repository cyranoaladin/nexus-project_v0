import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DevisWizard } from '@/components/quotes/DevisWizard';
import type { BudgetStrategy, QuoteScenario, RecommendationResult, ScenarioTier } from '@/lib/quotes/schemas';

const provisionalCopy =
  'Cette estimation est établie à partir de votre situation scolaire, des épreuves à préparer et du budget indiqué. Le bilan Nexus permettra ensuite d’affiner les matières, les volumes et le parcours recommandé.';

function makeScenario(tier: ScenarioTier, monthlyTotal: number, pilotageMonthly = 150): QuoteScenario {
  return {
    tier,
    lines: [
      {
        subject: 'pilotage',
        label: 'Pilotage Nexus',
        modality: 'PILOTAGE',
        hoursPerMonth: 0,
        unitPriceMonthly: pilotageMonthly,
        priorityScore: Number.MAX_SAFE_INTEGER,
        priorityLabel: 'haute',
        reason: 'Cadre de suivi incompressible.',
      },
    ],
    notRecommended: [],
    monthlyTotal,
    grandTotal: monthlyTotal * 10,
    months: 10,
    matchedOfferId: null,
  };
}

function makeRecommendation(pilotageMonthly = 150): RecommendationResult {
  return {
    pricingVersion: '2026-2027-test',
    examPolicyVersion: '2027-test',
    examSession: 2027,
    scenarios: [
      makeScenario('ESSENTIEL', pilotageMonthly, pilotageMonthly),
      makeScenario('RECOMMANDE', 650, pilotageMonthly),
      makeScenario('COMPLET', 1044, pilotageMonthly),
    ],
  };
}

async function reachResult(
  strategy: BudgetStrategy,
  budget = 800,
  recommendation = makeRecommendation(),
) {
  const user = userEvent.setup();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ result: recommendation }),
  }) as jest.Mock;

  render(<DevisWizard />);
  await user.click(screen.getByText('Première', { exact: true }));
  await user.click(screen.getByText('Candidat individuel', { exact: true }));
  await user.click(screen.getByRole('button', { name: 'Continuer' }));
  await user.click(screen.getByRole('button', { name: 'Continuer' }));
  await user.click(screen.getByRole('button', { name: 'Continuer' }));
  await user.click(screen.getByRole('button', { name: 'Continuer' }));

  const strategyLabel: Record<BudgetStrategy, string> = {
    RESPECT_BUDGET: 'Respecter strictement mon budget',
    BEST_BALANCE: 'Me proposer le meilleur équilibre',
    MOST_COMPLETE: 'Préparation la plus complète utile',
  };
  await user.click(screen.getByText(strategyLabel[strategy], { exact: true }));
  const budgetInput = screen.getByLabelText('Budget mensuel, saisie libre');
  await user.clear(budgetInput);
  await user.type(budgetInput, String(budget));
  await user.click(screen.getByRole('button', { name: 'Voir mon estimation' }));

  await screen.findByRole('heading', { name: 'Estimation provisoire' });
}

describe('DevisWizard — estimation provisoire sans bilan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each([
    ['RESPECT_BUDGET', 'essentiel'],
    ['BEST_BALANCE', 'recommande'],
    ['MOST_COMPLETE', 'complet'],
  ] as const)(
    'affiche uniquement le scénario choisi par la famille pour %s',
    async (strategy, expectedTier) => {
      await reachResult(strategy);

      expect(screen.getByText(provisionalCopy, { exact: true })).toBeInTheDocument();
      expect(screen.getAllByTestId(/^scenario-card-/)).toHaveLength(1);
      expect(screen.getByTestId(`scenario-card-${expectedTier}`)).toBeVisible();
    },
  );

  test('sous le coût du Pilotage, explique la limite et dérive le montant du scénario reçu', async () => {
    await reachResult('RESPECT_BUDGET', 100, makeRecommendation(173));

    expect(
      screen.getByText(/Aucun accompagnement complet ne peut respecter ce budget/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/coût incompressible du Pilotage Nexus est de 173 TND par mois/i)).toBeInTheDocument();
  });

  test('conserve le scénario lié à la stratégie lors de la création du devis', async () => {
    await reachResult('MOST_COMPLETE');
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'quote-test-token' }),
    });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Recevoir mon devis détaillé' }));
    await user.type(screen.getByLabelText('Votre nom'), 'Parent Test');
    await user.type(screen.getByLabelText('Prénom du candidat'), 'Élève');
    await user.type(screen.getByLabelText('Numéro WhatsApp'), '99192829');
    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.click(screen.getByText("J'accepte d'être recontacté(e) par Nexus Réussite au sujet de ce devis."));
    await user.click(screen.getByRole('button', { name: 'Recevoir mon devis' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    const [, options] = (global.fetch as jest.Mock).mock.calls[1];
    expect(JSON.parse(options.body)).toMatchObject({ scenarioTier: 'COMPLET' });
  });
});
