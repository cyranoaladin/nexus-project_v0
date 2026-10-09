import { render, screen } from '@testing-library/react';

import AssistanteFacturationPage from '@/app/dashboard/assistante/facturation/page';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

jest.mock('@/app/dashboard/admin/facturation/page', () => ({
  __esModule: true,
  default: () => <div data-testid="authorized-invoice-list" />,
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

    expect(screen.getByTestId('authorized-invoice-list')).toBeInTheDocument();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('renders for ADMIN', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });

    render(await AssistanteFacturationPage());

    expect(screen.getByTestId('authorized-invoice-list')).toBeInTheDocument();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('redirects an allowed role without canonical user identity', async () => {
    mockAuth.mockResolvedValue({ user: { role: 'ASSISTANTE' } });
    await expect(AssistanteFacturationPage()).rejects.toThrow('NEXT_REDIRECT:/auth/signin');
    expect(mockRedirect).toHaveBeenCalledWith('/auth/signin');
  });

  it('redirects unauthenticated users', async () => {
    mockAuth.mockResolvedValue(null);

    await expect(AssistanteFacturationPage()).rejects.toThrow('NEXT_REDIRECT:/auth/signin');
    expect(mockRedirect).toHaveBeenCalledWith('/auth/signin');
  });

  it.each(['ELEVE', 'PARENT', 'COACH', 'UNKNOWN'])('redirects unauthorized %s', async role => {
    mockAuth.mockResolvedValue({ user: { id: 'synthetic-denied', role } });

    await expect(AssistanteFacturationPage()).rejects.toThrow('NEXT_REDIRECT:/auth/signin');
    expect(mockRedirect).toHaveBeenCalledWith('/auth/signin');
  });
});
