import React from 'react';
import { render, screen } from '@testing-library/react';
import { CarteNexusCard } from '@/components/premium/CarteNexusCard';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import type { CarteNexus } from '@/lib/pricing';

const carte: CarteNexus = {
  id: 'carte-nexus',
  title: 'Carte Nexus',
  price_annual: 390,
  includes: [
    'ARIA Autonomie inclus (valeur 590 TND)',
    '1 Diagnostic Stratégique offert (100 TND)',
    'Réservation prioritaire dans les groupes',
    '1 épreuve blanche offerte / an (150 TND)',
    '1 mois ARIA supplémentaire (avantage membre)',
  ],
  rationale: "Carte d'accès et d'avantages en nature (grille C)...",
  discount_pct: 0,
  non_cumulable: true,
};

describe('CarteNexusCard', () => {
  it('renders the 390 TND price', () => {
    render(<CarteNexusCard carte={carte} ctaHref="#" />);
    expect(screen.getByText(/390\s*TND/)).toBeInTheDocument();
  });

  it('renders every in-kind benefit from includes', () => {
    render(<CarteNexusCard carte={carte} ctaHref="#" />);
    for (const item of carte.includes) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
  });

  it('never mentions a percentage discount or a floor rate', () => {
    const { container } = render(<CarteNexusCard carte={carte} ctaHref="#" />);
    expect(container.textContent).not.toMatch(/%/);
    expect(container.textContent).not.toMatch(/plancher/i);
    expect(container.textContent).not.toMatch(/remise/i);
  });

  it('links the primary CTA to the provided href', () => {
    render(<CarteNexusCard carte={carte} ctaHref="/bilan-gratuit" ctaText="Prendre la Carte Nexus" />);
    const link = screen.getByRole('link', { name: 'Prendre la Carte Nexus' });
    expect(link).toHaveAttribute('href', '/bilan-gratuit');
  });

  it('builds its WhatsApp CTA via the centralized helper', () => {
    render(<CarteNexusCard carte={carte} ctaHref="#" />);
    const link = screen.getByRole('link', { name: /poser une question/i });
    expect(link).toHaveAttribute('href', buildWhatsAppUrl(`l’offre ${carte.title}`));
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
