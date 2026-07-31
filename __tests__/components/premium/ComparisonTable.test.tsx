import React from 'react';
import { render, screen } from '@testing-library/react';
import { ComparisonTable, type ComparisonRow } from '@/components/premium/ComparisonTable';

const rows: ComparisonRow[] = [
  { feature: 'Diagnostic + carte d’examen', nexus: true, traditional: false },
  { feature: 'Méthode alignée sur le programme officiel', nexus: true, traditional: false },
  { feature: 'Tableau de bord parent & élève', nexus: true, traditional: false },
  { feature: 'Accompagnement hors séances', nexus: true, traditional: false },
  { feature: 'Bilans réguliers', nexus: true, traditional: false },
  { feature: 'Épreuves blanches sur grille officielle', nexus: true, traditional: false },
  { feature: 'Studio Grand Oral', nexus: true, traditional: false },
  { feature: 'Cellule Candidat Libre', nexus: true, traditional: false },
  { feature: 'Tarifs publics, remboursables', nexus: true, traditional: false },
];

describe('ComparisonTable', () => {
  it('renders the Nexus vs Soutien classique column headers', () => {
    render(<ComparisonTable rows={rows} />);
    expect(screen.getByText('Nexus Réussite')).toBeInTheDocument();
    expect(screen.getByText('Soutien classique')).toBeInTheDocument();
  });

  it('renders every comparison row feature label', () => {
    render(<ComparisonTable rows={rows} />);
    for (const row of rows) {
      expect(screen.getByText(row.feature)).toBeInTheDocument();
    }
  });

  it('renders a check mark for Nexus and a cross for the traditional column on boolean rows', () => {
    const { container } = render(<ComparisonTable rows={[{ feature: 'X', nexus: true, traditional: false }]} />);
    const row = screen.getByText('X').closest('tr');
    expect(row).not.toBeNull();
    // lucide-react Check/X render as <svg> — one per boolean cell.
    expect(row!.querySelectorAll('svg').length).toBe(2);
    expect(container.querySelectorAll('table').length).toBe(1);
  });

  it('renders string values as plain text instead of an icon', () => {
    render(<ComparisonTable rows={[{ feature: 'Y', nexus: 'Illimité', traditional: '1h/semaine' }]} />);
    expect(screen.getByText('Illimité')).toBeInTheDocument();
    expect(screen.getByText('1h/semaine')).toBeInTheDocument();
  });
});
