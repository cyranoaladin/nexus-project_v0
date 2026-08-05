import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import React from 'react';
import AddChildDialog from '@/app/dashboard/parent/add-child-dialog';

describe('AddChildDialog', () => {
  test('opens when a controlled open prop is set to true (banner CTA use case)', () => {
    render(<AddChildDialog onChildAdded={jest.fn()} open={true} onOpenChange={jest.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/prénom/i)).toBeInTheDocument();
  });

  test('stays closed by default when no controlled open prop is given', () => {
    render(<AddChildDialog onChildAdded={jest.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
