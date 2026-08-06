import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import React from 'react';

import ActivatePage from '@/app/auth/activate/page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({
    get: (key: string) => key === 'token' ? 'act_accessible_test' : null,
  }),
}));

describe('ActivatePage accessibility', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({
        valid: true,
        studentName: 'Élève Synthétique',
        email: 'eleve.synthetique@nexus-student.local',
        accountRole: 'PARENT',
      }),
    }) as jest.Mock;
  });

  it('associates stable accessible names and form names with every activation field', async () => {
    render(<ActivatePage />);

    const login = await screen.findByRole('textbox', { name: 'Identifiant de connexion' });
    const password = screen.getByLabelText('Mot de passe', { exact: true });
    const confirmation = screen.getByLabelText('Confirmer le mot de passe', { exact: true });

    expect(login).toHaveAttribute('id', 'student-login-identifier');
    expect(login).toHaveAttribute('name', 'loginIdentifier');
    expect(password).toHaveAttribute('id', 'student-password');
    expect(password).toHaveAttribute('name', 'password');
    expect(confirmation).toHaveAttribute('id', 'student-password-confirmation');
    expect(confirmation).toHaveAttribute('name', 'passwordConfirmation');
    expect(screen.getByRole('heading', { name: 'Activer votre espace parent' })).toBeInTheDocument();
    expect(screen.queryByText(/accéder à votre espace élève/i)).not.toBeInTheDocument();
  });
});
