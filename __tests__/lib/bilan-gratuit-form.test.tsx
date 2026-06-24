import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import BilanGratuitPage from '../../app/bilan-gratuit/page';
import { CGV_POLICY } from '@/lib/cgv-policy';
import { LEGAL } from '@/lib/legal';

const mockPush = jest.fn();
const mockFetch = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/bilan-gratuit',
}));

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
  Toaster: () => null,
}));

jest.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_target, prop) => (props: any) => React.createElement(prop as any, props, props.children),
  }),
  useReducedMotion: () => false,
}));

describe('BilanGratuitPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    (global as any).fetch = mockFetch;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, parentId: 'parent-1', studentId: 'student-1' }),
    });
  });

  function fillInput(id: string, value: string) {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!el) throw new Error(`Input ${id} not found`);
    fireEvent.change(el, { target: { value } });
  }

  it('renders the strategic bilan funnel without a password field', () => {
    render(<BilanGratuitPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Bilan stratégique gratuit' })).toBeInTheDocument();
    expect(screen.getByText(/Identifier les priorités de votre enfant/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/mot de passe/i)).not.toBeInTheDocument();
  });

  it('shows card payment policy for a selected offer without public RIB/IBAN', () => {
    mockSearchParams = new URLSearchParams('offer=term-spe-simple');
    const { container } = render(<BilanGratuitPage />);

    expect(screen.getByText(/offre repérée/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(CGV_POLICY.payment.provider, 'i'))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(CGV_POLICY.payment.bank, 'i'))).toBeInTheDocument();
    expect(screen.getByText(CGV_POLICY.payment.cardFee)).toBeInTheDocument();
    expect(container.textContent).not.toContain(LEGAL.billing.rib);
    expect(container.textContent).not.toContain(LEGAL.billing.iban);
  });

  it('submits the public form and redirects to confirmation', async () => {
    const user = userEvent.setup();
    render(<BilanGratuitPage />);

    fillInput('parentFirstName', 'Jean');
    fillInput('parentLastName', 'Dupont');
    fillInput('parentEmail', 'jean.dupont@example.com');
    fillInput('parentPhone', '+21699192829');
    fillInput('studentFirstName', 'Marie');
    fillInput('studentSchool', 'Lycée Victor Hugo');
    fillInput('objectives', 'Reprendre le rythme et structurer le travail');
    fillInput('difficulties', 'Besoin d’un cadre de travail plus régulier');

    const gradeSelect = screen.getByLabelText('Classe');
    fireEvent.change(gradeSelect, { target: { value: 'terminale' } });

    await user.click(screen.getByLabelText('Mathématiques'));
    await user.click(screen.getByRole('checkbox', { name: /j.*accepte/i }));
    await user.click(screen.getByRole('button', { name: /demander mon bilan stratégique gratuit/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/bilan-gratuit',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/bilan-gratuit/confirmation');
    });
  });
});
