import { render, screen } from '@testing-library/react';

import { NexusInvoiceGenerator } from '@/components/facturation/NexusInvoiceGenerator';

describe('NexusInvoiceGenerator', () => {
  it('renders the production invoice assistant with logo, presets, payments and required footer', () => {
    render(<NexusInvoiceGenerator />);

    expect(screen.getByRole('img', { name: /logo nexus réussite/i })).toHaveAttribute(
      'src',
      '/images/logo_slogan_nexus.png'
    );
    expect(screen.getAllByText('Duo Première — Français + Maths').length).toBeGreaterThan(0);
    expect(screen.getByText('Français Première — Sprint EAF')).toBeInTheDocument();
    expect(screen.getByText('Forfait personnalisé')).toBeInTheDocument();
    expect(screen.getAllByText('Virement bancaire').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Chèque').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Espèces').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Accès plateforme EAF — ARIA offert').length).toBeGreaterThan(0);
    expect(screen.getByText(/Prix forfaitaire incluant une remise commerciale de 39,000 TND/)).toBeInTheDocument();
    expect(screen.queryByText(/Remise forfaitaire intégrée/i)).not.toBeInTheDocument();
    expect(screen.getByText('Viser. Atteindre. Dépasser.')).toBeInTheDocument();
    expect(
      screen.getAllByText(/Centre Urbain Nord, Immeuble VENUS, Appt C13, 1082/).length
    ).toBeGreaterThan(0);
    expect(screen.getByText(/contact@nexusreussite\.academy/)).toBeInTheDocument();
    expect(screen.getByText(/Montant total TTC/i)).toBeInTheDocument();
    expect(screen.queryByText(/Arrêté la présente facture/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sans tampon/i)).not.toBeInTheDocument();
  });
});
