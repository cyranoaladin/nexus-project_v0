import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { OfferDetailDialog, type OfferDetail } from '@/components/marketing/OfferDetailDialog';
import {
  getAnnualOffer, getAnnualOfferPaymentSchedule, getRules,
  getStageFormat, getPonctuelOffer, getCoachingOffer, getPack,
} from '@/lib/pricing';
import { fmtTND } from '@/components/premium/format';
import { CGV_POLICY } from '@/lib/cgv-policy';
import { LEGAL } from '@/lib/legal';

// Suppress ResizeObserver warnings in jsdom
beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});

const pricingRules = getRules();

const sampleOffer: OfferDetail = {
  id: 'term-duo',
  title: 'Terminale Duo',
  eyebrow: 'Terminale · Parcours présentiel',
  format: 'Présentiel Mutuelleville',
  groupMax: pricingRules.group_max,
  groupMinOpen: pricingRules.group_min_open.lycee,
  price: 7175,
  payment: {
    deposit: 2150,
    installments: [560, 560, 560, 560, 560, 560, 560, 560, 545],
    depositPct: 30,
  },
  included: [
    '2 spécialités au choix, 4 h / semaine',
    'Bacs blancs sur grilles officielles',
    'Accès plateforme ARIA',
  ],
  availabilityNote: `Ouverture dès ${pricingRules.group_min_open.lycee} inscrits. Places limitées à ${pricingRules.group_max} par groupe.`,
};

describe('OfferDetailDialog', () => {
  it('renders nothing when offer is null', () => {
    const { container } = render(
      <OfferDetailDialog offer={null} onClose={jest.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders offer title and eyebrow', () => {
    render(<OfferDetailDialog offer={sampleOffer} onClose={jest.fn()} />);
    expect(screen.getByText('Terminale Duo')).toBeInTheDocument();
    expect(screen.getByText('Terminale · Parcours présentiel')).toBeInTheDocument();
  });

  it('renders format and group size', () => {
    render(<OfferDetailDialog offer={sampleOffer} onClose={jest.fn()} />);
    expect(screen.getByText(/Présentiel Mutuelleville/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${pricingRules.group_max} élèves max`))).toBeInTheDocument();
  });

  it('displays the real monthly installment and annual total from canonical payment fields', () => {
    render(<OfferDetailDialog offer={sampleOffer} onClose={jest.fn()} />);
    expect(screen.getAllByText(/560\s*TND/).length).toBeGreaterThan(0);
    expect(screen.getByText(/mois hors acompte/)).toBeInTheDocument();
    expect(screen.getByText(/7[\s\u00A0\u202F]?175\s*TND/)).toBeInTheDocument();
  });

  it('does NOT display a strikethrough price (prix barre removed)', () => {
    render(<OfferDetailDialog offer={sampleOffer} onClose={jest.fn()} />);
    expect(screen.queryByText(/8[\s\u00A0\u202F]?750\s*TND/)).not.toBeInTheDocument();
  });

  it('displays deposit from canonical payment field', () => {
    render(<OfferDetailDialog offer={sampleOffer} onClose={jest.fn()} />);
    expect(screen.getAllByText(/2[\s\u00A0\u202F]?150\s*TND/).length).toBeGreaterThan(0);
  });

  it('displays included items', () => {
    render(<OfferDetailDialog offer={sampleOffer} onClose={jest.fn()} />);
    expect(screen.getByText('Accès plateforme ARIA')).toBeInTheDocument();
  });

  it('has correct ARIA attributes', () => {
    render(<OfferDetailDialog offer={sampleOffer} onClose={jest.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'offer-dialog-title');
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = jest.fn();
    render(<OfferDetailDialog offer={sampleOffer} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay is clicked', () => {
    const onClose = jest.fn();
    render(<OfferDetailDialog offer={sampleOffer} onClose={onClose} />);
    // The overlay is the outermost div with role="presentation"
    const overlay = screen.getByRole('presentation');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has CTA linking to bilan-gratuit with offer ID', () => {
    render(<OfferDetailDialog offer={sampleOffer} onClose={jest.fn()} />);
    const reserveLink = screen.getByRole('link', { name: /réserver ma place/i });
    expect(reserveLink).toHaveAttribute('href', '/bilan-gratuit?offer=term-duo');
  });

  it('has WhatsApp CTA with contextual message', () => {
    render(<OfferDetailDialog offer={sampleOffer} onClose={jest.fn()} />);
    const waLink = screen.getByRole('link', { name: /poser une question/i });
    expect(waLink.getAttribute('href')).toContain('wa.me/');
    expect(decodeURIComponent(waLink.getAttribute('href')!)).toContain('Terminale Duo');
  });

  it('keeps card payment provider hidden until public activation is explicitly enabled', () => {
    const { container } = render(<OfferDetailDialog offer={sampleOffer} onClose={jest.fn()} />);

    expect(screen.getByText(/paiement confirmé après validation pédagogique/i)).toBeInTheDocument();
    expect(container.textContent).not.toContain(CGV_POLICY.payment.provider);
    expect(container.textContent).not.toContain(CGV_POLICY.payment.bank);
    expect(container.textContent).not.toContain(CGV_POLICY.payment.acceptedCards);
    expect(container.textContent).not.toContain(CGV_POLICY.payment.cardFee);
    expect(container.textContent).not.toContain(LEGAL.billing.rib);
    expect(container.textContent).not.toContain(LEGAL.billing.iban);
  });

  it('group max never exceeds 5', () => {
    render(<OfferDetailDialog offer={sampleOffer} onClose={jest.fn()} />);
    const text = screen.getByText(/élèves max/);
    expect(text.textContent).toMatch(/[1-5] élèves max/);
  });
});

describe('OfferDetailDialog — échéancier rendered = canonical (real RTL render)', () => {
  it('term-duo modal displays the canonical deposit amount', () => {
    const canonical = getAnnualOffer('term-duo');
    expect(canonical).toBeDefined();
    if (!canonical) return;

    const payment = getAnnualOfferPaymentSchedule(canonical);
    const detail: OfferDetail = {
      id: canonical.id,
      title: canonical.title,
      eyebrow: 'Test',
      price: canonical.price_annual ?? 0,
      payment: payment
        ? { deposit: payment.deposit, installments: payment.installments }
        : undefined,
      included: canonical.included,
    };

    render(<OfferDetailDialog offer={detail} onClose={jest.fn()} />);
    const depositRegex = new RegExp(
      String(canonical.deposit!).replace(/(\d)(?=(\d{3})+$)/g, '$1[\\s\\u00A0\\u202F]?') + '\\s*TND'
    );
    expect(screen.getAllByText(depositRegex).length).toBeGreaterThan(0);
  });

  it('renders installment amounts from canonical when modal is open', () => {
    const canonical = getAnnualOffer('term-duo');
    if (!canonical) return;
    const payment = getAnnualOfferPaymentSchedule(canonical);
    if (!payment) return;

    const detail: OfferDetail = {
      id: canonical.id, title: canonical.title, eyebrow: 'Test',
      price: canonical.price_annual ?? 0,
      payment: { deposit: payment.deposit, installments: payment.installments },
      included: canonical.included,
    };

    const { container } = render(<OfferDetailDialog offer={detail} onClose={jest.fn()} />);
    const html = container.innerHTML;

    // The rendered HTML must contain the deposit amount
    expect(html).toContain(fmtTND(payment.deposit));
    // And at least the first installment amount
    expect(html).toContain(fmtTND(payment.installments[0]));
  });

  it('renders stage format solde within échéancier block', () => {
    const stage = getStageFormat('intensif-solo');
    expect(stage).toBeDefined();
    if (!stage) return;

    render(<OfferDetailDialog offer={{
      id: stage.format_id, title: stage.title, eyebrow: 'Intensif',
      price: stage.price_per_student,
      payment: { deposit: stage.payment.deposit, solde: stage.payment.solde },
      included: [],
    }} onClose={jest.fn()} />);

    const echeancier = screen.getByTestId('echeancier');
    expect(within(echeancier).getByText(/Acompte/)).toBeInTheDocument();
    expect(echeancier.innerHTML).toContain(fmtTND(stage.payment.deposit));
    expect(echeancier.innerHTML).toContain(fmtTND(stage.payment.solde));
  });

  it('renders full_at_booking from canonical', () => {
    const ep = getPonctuelOffer('epreuve-blanche');
    expect(ep).toBeDefined();
    if (!ep) return;

    render(<OfferDetailDialog offer={{
      id: ep.id, title: ep.title, eyebrow: 'Ponctuel',
      price: ep.price_per_student,
      payment: { deposit: ep.payment.deposit, full_at_booking: true },
      included: [],
    }} onClose={jest.fn()} />);

    expect(screen.getByText(/intégral.*réservation|réservation.*intégral/i)).toBeInTheDocument();
  });

  it('renders "dernière traite différente" with arrow notation', () => {
    // Find an annual offer where last installment differs from regular
    const offer = getAnnualOffer('term-duo');
    if (!offer) return;
    const payment = getAnnualOfferPaymentSchedule(offer);
    if (!payment || payment.installments.length < 2) return;
    const last = payment.installments[payment.installments.length - 1];
    const first = payment.installments[0];

    render(<OfferDetailDialog offer={{
      id: offer.id, title: offer.title, eyebrow: 'Test',
      price: offer.price_annual ?? 0,
      payment: { deposit: payment.deposit, installments: payment.installments },
      included: offer.included,
    }} onClose={jest.fn()} />);

    const echeancier = screen.getByTestId('echeancier');
    if (last !== first) {
      // Should show "X TND → Y TND" arrow notation
      expect(echeancier.innerHTML).toContain(fmtTND(first));
      expect(echeancier.innerHTML).toContain(fmtTND(last));
      expect(echeancier.innerHTML).toContain('→');
    } else {
      // All equal — single amount shown
      expect(echeancier.innerHTML).toContain(fmtTND(first));
    }
  });

  it('renders coaching solde_schedule within échéancier', () => {
    const coaching = getCoachingOffer('boussole-individuel-pack3');
    if (!coaching || coaching.payment.full_at_booking) return;

    const schedule = coaching.payment.solde_schedule || [];
    render(<OfferDetailDialog offer={{
      id: coaching.id, title: coaching.title, eyebrow: 'Boussole',
      price: coaching.price,
      payment: {
        deposit: coaching.payment.deposit,
        solde_schedule: schedule,
      },
      included: [],
    }} onClose={jest.fn()} />);

    if (schedule.length > 0) {
      const echeancier = screen.getByTestId('echeancier');
      expect(within(echeancier).getByText(/Acompte/)).toBeInTheDocument();
      schedule.forEach((amount, i) => {
        expect(echeancier.innerHTML).toContain(fmtTND(amount));
      });
    }
  });

  it('renders pack solde_schedule within échéancier', () => {
    const pack = getPack('pass-intensifs-1re');
    if (!pack) return;

    render(<OfferDetailDialog offer={{
      id: pack.id, title: pack.title, eyebrow: 'Pass',
      price: pack.price,
      payment: {
        deposit: pack.payment.deposit,
        solde_schedule: pack.payment.solde_schedule,
      },
      included: [],
    }} onClose={jest.fn()} />);

    const echeancier = screen.getByTestId('echeancier');
    expect(within(echeancier).getByText(/Acompte/)).toBeInTheDocument();
    pack.payment.solde_schedule.forEach((amount) => {
      expect(echeancier.innerHTML).toContain(fmtTND(amount));
    });
  });
});
