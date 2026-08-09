import '@testing-library/jest-dom';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';

import { PreRentreeDiagnosticCtas } from '@/components/marketing/PreRentreeDiagnosticCtas';

const root = process.cwd();

describe('CTA publics du bilan de pré-rentrée', () => {
  it('distingue la passation en ligne du rappel conseiller', () => {
    render(<PreRentreeDiagnosticCtas />);

    expect(screen.getByRole('link', { name: 'Passer le bilan de pré-rentrée' })).toHaveAttribute(
      'href',
      '/bilan-gratuit?parcours=diagnostic#demande-bilan',
    );
    expect(screen.getByRole('link', { name: 'Être rappelé par un conseiller' })).toHaveAttribute(
      'href',
      '/bilan-gratuit?parcours=conseiller#rappel-conseiller',
    );
  });

  it.each([
    'app/HomePageClient.tsx',
    'app/stages/pre-rentree-2026/page.tsx',
  ])('est rendu sur la surface publique %s', (file) => {
    expect(readFileSync(join(root, file), 'utf8')).toContain('<PreRentreeDiagnosticCtas');
  });

  it('ancre séparément le formulaire diagnostic et le rappel conseiller', () => {
    const source = readFileSync(join(root, 'app/bilan-gratuit/BilanStrategiqueClient.tsx'), 'utf8');
    expect(source).toContain('id="demande-bilan"');
    expect(source).toContain('id="rappel-conseiller"');
  });
});
