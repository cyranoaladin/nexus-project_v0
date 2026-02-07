import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import StagesFevrier2026Page from '@/app/stages/fevrier-2026/page';

// Mock Next.js components
jest.mock('next/script', () => {
  return function Script() {
    return null;
  };
});

jest.mock('@/components/layout/header', () => ({
  Header: () => <div data-testid="header">Header</div>,
}));

jest.mock('@/components/layout/footer', () => ({
  Footer: () => <div data-testid="footer">Footer</div>,
}));

describe('Stages Février 2026 - CTA Count', () => {
  it('should have at least 7 primary CTAs', () => {
    render(<StagesFevrier2026Page />);

    // Primary CTA text variations
    const primaryCTATexts = [
      /réserver une consultation gratuite/i,
      /réserver un bilan gratuit/i,
      /bilan gratuit/i,
    ];

    let totalCTACount = 0;

    primaryCTATexts.forEach((ctaText) => {
      const ctas = screen.queryAllByText(ctaText);
      totalCTACount += ctas.length;
    });

    // Should have at least 7 CTAs
    expect(totalCTACount).toBeGreaterThanOrEqual(7);
  });

  it('should have secondary CTA (Découvrir les académies)', () => {
    render(<StagesFevrier2026Page />);
    
    const secondaryCTAs = screen.queryAllByText(/découvrir les académies/i);
    expect(secondaryCTAs.length).toBeGreaterThan(0);
  });

  it('should have urgency banner', () => {
    render(<StagesFevrier2026Page />);
    
    const urgencyText = screen.getByText(/stages février 2026/i);
    expect(urgencyText).toBeInTheDocument();
  });

  it('should have H1 with correct title', () => {
    render(<StagesFevrier2026Page />);
    
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent(/stage de février/i);
    expect(h1).toHaveTextContent(/boost décisif/i);
  });

  it('should render all major sections', () => {
    render(<StagesFevrier2026Page />);
    
    // Check for key section headings
    expect(screen.getByText(/février : le moment qui décide/i)).toBeInTheDocument();
    expect(screen.getByText(/deux paliers pour répondre à chaque profil/i)).toBeInTheDocument();
    expect(screen.getByText(/nos académies février 2026/i)).toBeInTheDocument();
    const faqHeadings = screen.getAllByText(/questions fréquentes/i);
    expect(faqHeadings.length).toBeGreaterThan(0);
  });

  it('should have stats section', () => {
    render(<StagesFevrier2026Page />);
    
    const stats98 = screen.getAllByText(/98%/i);
    const statsPoints = screen.getAllByText(/\+4,2 pts/i);
    const stats150 = screen.getAllByText(/150\+/i);
    
    expect(stats98.length).toBeGreaterThan(0);
    expect(statsPoints.length).toBeGreaterThan(0);
    expect(stats150.length).toBeGreaterThan(0);
  });
});
