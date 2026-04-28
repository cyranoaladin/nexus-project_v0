import { render, screen } from '@testing-library/react';

import AssistanteFacturationPage from '@/app/dashboard/assistante/facturation/page';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

jest.mock('@/components/facturation/NexusInvoiceGenerator', () => ({
  NexusInvoiceGenerator: () => <div data-testid="nexus-invoice-generator" />,
}));

jest.mock('next/navigation', () => {
  const actual = jest.requireActual('next/navigation');
  return {
    ...actual,
    redirect: jest.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    }),
  };
});

const mockAuth = auth as unknown as jest.Mock;
const mockRedirect = redirect as unknown as jest.Mock;

describe('/dashboard/assistante/facturation access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders for ASSISTANTE', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'assistante-1', role: 'ASSISTANTE' } });

    render(await AssistanteFacturationPage());

    expect(screen.getByTestId('nexus-invoice-generator')).toBeInTheDocument();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('renders for ADMIN', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });

    render(await AssistanteFacturationPage());

    expect(screen.getByTestId('nexus-invoice-generator')).toBeInTheDocument();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('redirects unauthenticated users', async () => {
    mockAuth.mockResolvedValue(null);

    await expect(AssistanteFacturationPage()).rejects.toThrow('NEXT_REDIRECT:/auth/signin');
    expect(mockRedirect).toHaveBeenCalledWith('/auth/signin');
  });

  it('redirects students and other unauthorized roles', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'student-1', role: 'ELEVE' } });

    await expect(AssistanteFacturationPage()).rejects.toThrow('NEXT_REDIRECT:/auth/signin');
    expect(mockRedirect).toHaveBeenCalledWith('/auth/signin');
  });
});
