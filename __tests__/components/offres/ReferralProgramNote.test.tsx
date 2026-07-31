import React from 'react';
import { render, screen } from '@testing-library/react';
import { ReferralProgramNote } from '@/components/offres/ReferralProgramNote';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

const baseReferral = {
  enabled: true,
  reward_type: 'aria_months_free' as const,
  reward_months: 1,
  trigger: 'filleul_inscription_confirmee',
  cap_months_per_family_per_year: 3,
  convertible_to_cash: false,
  deductible_from_price_or_reservation: false,
  note: 'Avantage en nature, hors système de remises.',
};

describe('ReferralProgramNote', () => {
  it('renders nothing when the program is disabled', () => {
    const { container } = render(<ReferralProgramNote referral={{ ...baseReferral, enabled: false }} />);
    expect(container.firstChild).toBeNull();
  });

  it('states the in-kind reward: months of ARIA per registered referral, capped per year', () => {
    render(<ReferralProgramNote referral={baseReferral} />);
    expect(
      screen.getByText(/1 mois ARIA offert par filleul inscrit.*jusqu.{1,2}à 3 mois\s*\/\s*an/i),
    ).toBeInTheDocument();
  });

  it('never mentions a cash discount or a TND amount for parrainage', () => {
    const { container } = render(<ReferralProgramNote referral={baseReferral} />);
    expect(container.textContent).not.toMatch(/TND/);
    expect(container.textContent).not.toMatch(/remise/i);
    expect(container.textContent).not.toMatch(/réduction/i);
  });

  it('builds its WhatsApp CTA via the centralized helper, opened in a new tab', () => {
    render(<ReferralProgramNote referral={baseReferral} />);
    const link = screen.getByRole('link', { name: /whatsapp/i });
    expect(link).toHaveAttribute('href', buildWhatsAppUrl('le parrainage'));
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
