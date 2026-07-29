import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

import { authConfig } from '@/auth.config';
import BilanMagicPage from '@/app/auth/bilan-magic/page';

const RAW_TOKEN = 'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM';
const replace = jest.fn();

jest.mock('next-auth/react', () => ({
  signIn: jest.fn(),
}));
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const mockSignIn = signIn as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

describe('/auth/bilan-magic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({ replace });
    mockSignIn.mockResolvedValue({ ok: true, error: null });
    window.history.replaceState(null, '', '/auth/bilan-magic');
    window.location.hash = `token=${RAW_TOKEN}`;
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('clears the fragment before authenticating once and resumes the bilan', async () => {
    expect(window.location.hash).toContain(`token=${RAW_TOKEN}`);
    const initialParameters = new URLSearchParams(
      window.location.hash.replace(/^#/, ''),
    );
    expect(initialParameters.getAll('token')).toEqual([RAW_TOKEN]);
    expect(Array.from(initialParameters.keys())).toEqual(['token']);
    const originalReplaceState = window.history.replaceState.bind(window.history);
    const replaceState = jest
      .spyOn(window.history, 'replaceState')
      .mockImplementation((...arguments_) => originalReplaceState(...arguments_));
    const order: string[] = [];
    replaceState.mockImplementation((...arguments_) => {
      order.push('strip');
      originalReplaceState(...arguments_);
    });
    mockSignIn.mockImplementation(async () => {
      order.push('signin');
      return { ok: true, error: null };
    });

    render(
      <StrictMode>
        <BilanMagicPage />
      </StrictMode>,
    );

    await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/bilan-gratuit'));
    expect(order.slice(0, 2)).toEqual(['strip', 'signin']);
    expect(window.location.hash).toBe('');
    expect(mockSignIn).toHaveBeenCalledTimes(1);
    expect(mockSignIn).toHaveBeenCalledWith('bilan-magic', {
      redirect: false,
      token: RAW_TOKEN,
    });
    expect(document.body.textContent).not.toContain(RAW_TOKEN);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    replaceState.mockRestore();
  });

  it('shows a sober error when the provider refuses the token', async () => {
    mockSignIn.mockResolvedValue({ ok: false, error: 'CredentialsSignin' });

    render(<BilanMagicPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ce lien est invalide ou a expiré.',
    );
    expect(replace).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain(RAW_TOKEN);
  });

  it('does not authenticate or render data when the fragment is missing', async () => {
    window.history.replaceState(null, '', '/auth/bilan-magic');
    window.location.hash = '';

    render(<BilanMagicPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ce lien est invalide ou a expiré.',
    );
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('lets an already authenticated parent reach this exact auth page for consumption', async () => {
    const authorized = authConfig.callbacks!.authorized! as (
      input: unknown,
    ) => boolean | Response | Promise<boolean | Response>;

    expect(await authorized({
      auth: { user: { id: 'parent', role: 'PARENT' } },
      request: { nextUrl: new URL('https://nexusreussite.academy/auth/bilan-magic') },
    })).toBe(true);

    const signinResult = await authorized({
      auth: { user: { id: 'parent', role: 'PARENT' } },
      request: { nextUrl: new URL('https://nexusreussite.academy/auth/signin') },
    });
    expect(signinResult).not.toBe(true);
  });
});
