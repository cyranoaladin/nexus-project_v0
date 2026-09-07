import '@testing-library/jest-dom';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ParentChildrenEmptyState } from '@/components/dashboard/parent/ParentChildrenEmptyState';

describe('ParentChildrenEmptyState', () => {
  it('guide sans étape muette vers l’ajout du premier enfant', async () => {
    const onAddChild = jest.fn();
    render(<ParentChildrenEmptyState onAddChild={onAddChild} />);

    expect(screen.getByText(/demandez l.?ajout de votre enfant/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Demander l’ajout de votre enfant' }));
    expect(onAddChild).toHaveBeenCalledTimes(1);
  });
});
