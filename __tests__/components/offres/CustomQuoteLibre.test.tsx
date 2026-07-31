import React from 'react';
import { render, screen } from '@testing-library/react';
import { CustomQuoteLibre } from '@/components/offres/CustomQuoteLibre';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

const baseQuote = {
  enabled: true,
  title: 'Candidat libre : un devis selon votre profil',
  description: 'Nombre de matières, niveau de départ, autonomie souhaitée, accompagnement Cyclades/IFT.',
  reservation: 250,
  installments_default: 10,
  min_price_per_student_hour: 44,
  cta: {
    bilan_label: 'Bilan gratuit',
    bilan_href: '/bilan-gratuit',
    whatsapp_label: 'WhatsApp',
  },
  includes: [
    'Cellule Candidat Libre incluse',
    'Réservation 250 TND déductible/remboursable',
    'Échéancier 10 mensualités',
    'Composition à la carte selon le bilan',
  ],
};

describe('CustomQuoteLibre', () => {
  it('renders nothing when the quote is disabled', () => {
    const { container } = render(<CustomQuoteLibre quote={{ ...baseQuote, enabled: false }} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the title and description', () => {
    render(<CustomQuoteLibre quote={baseQuote} />);
    expect(screen.getByText(baseQuote.title)).toBeInTheDocument();
    expect(screen.getByText(baseQuote.description)).toBeInTheDocument();
  });

  it('renders every include item, with Cellule Candidat Libre listed first', () => {
    render(<CustomQuoteLibre quote={baseQuote} />);
    for (const item of baseQuote.includes) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
    const list = screen.getByTestId('custom-quote-libre-includes');
    const items = Array.from(list.querySelectorAll('li')).map((li) => li.textContent);
    expect(items[0]).toContain('Cellule Candidat Libre');
  });

  it('shows a "bilan gratuit" note and never a computed annual price', () => {
    render(<CustomQuoteLibre quote={baseQuote} />);
    expect(screen.getByTestId('custom-quote-price-note').textContent).toMatch(/bilan gratuit/i);
    // No standalone "X TND / an" style headline price is rendered.
    expect(screen.queryByTestId('price-primary')).not.toBeInTheDocument();
  });

  it('links the bilan gratuit CTA to the canonical href', () => {
    render(<CustomQuoteLibre quote={baseQuote} />);
    const link = screen.getByRole('link', { name: /bilan gratuit/i });
    expect(link).toHaveAttribute('href', baseQuote.cta.bilan_href);
  });

  it('builds the WhatsApp CTA via the centralized helper, opened in a new tab', () => {
    render(<CustomQuoteLibre quote={baseQuote} />);
    const link = screen.getByRole('link', { name: /whatsapp/i });
    expect(link).toHaveAttribute('href', buildWhatsAppUrl(baseQuote.title));
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
