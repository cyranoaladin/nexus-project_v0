import { render, screen } from '@testing-library/react';
import ConsultingPage from '@/app/consulting/page';

describe('Consulting page', () => {
  it('renders hero heading', () => {
    render(<ConsultingPage />);

    expect(
      screen.getByRole('heading', { name: /Expertise 360° : L'Alliance de la Pédagogie et de la Technologie/i })
    ).toBeInTheDocument();

    const contactLink = screen.getByRole('link', { name: /Contacter la Direction Technique/i });
    expect(contactLink).toHaveAttribute('href', '/contact');

    const devisLink = screen.getByRole('link', { name: /Demander un devis/i });
    expect(devisLink).toHaveAttribute('href', '/contact');
  });
});
