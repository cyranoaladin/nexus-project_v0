import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { CreateSubmissionButton } from '@/components/npc/coach/CreateSubmissionButton';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock('@/components/ui/select', () => {
  const React = require('react');

  type MockSelectProps = {
    children?: React.ReactNode;
    value?: string;
    onValueChange?: (value: string) => void;
  };

  type MockSelectItemProps = {
    children?: React.ReactNode;
    value: string;
  };

  type MockSelectTriggerProps = {
    children?: React.ReactNode;
  };

  type MockSelectValueProps = {
    placeholder?: string;
  };

  type MockSelectContentProps = {
    children?: React.ReactNode;
  };

  const MockSelect = ({ children, value, onValueChange }: MockSelectProps) => {
    return (
      <select
        data-testid="mock-select"
        data-value={value}
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        {children}
      </select>
    );
  };

  return {
    Select: MockSelect,
    SelectContent: ({ children }: MockSelectContentProps) => children,
    SelectItem: ({ children, value }: MockSelectItemProps) => (
      <option value={value}>{children}</option>
    ),
    SelectTrigger: ({ children }: MockSelectTriggerProps) => children,
    SelectValue: ({ placeholder }: MockSelectValueProps) => <option value="">{placeholder}</option>,
  };
});

describe('CreateSubmissionButton Enhanced Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ submission: { id: 'sub-123' } }),
    }) as jest.Mock;
  });

  it('A. Cas succès avec un seul élève', async () => {
    const user = userEvent.setup();
    const students = [{ id: 'stud-1', name: 'Alice Liddell' }];

    render(<CreateSubmissionButton students={students} />);

    // ouvre la modale
    const openBtn = screen.getByRole('button', { name: /Nouvelle copie/i });
    await user.click(openBtn);

    // titre
    const titleInput = screen.getByPlaceholderText('Ex: DS Maths - Fonctions dérivées');
    fireEvent.change(titleInput, { target: { value: 'Bilan Printemps' } });

    // selects
    const selectElements = screen.getAllByTestId('mock-select');
    expect(selectElements.length).toBe(3);

    // pick subject
    fireEvent.change(selectElements[1], { target: { value: 'MATHEMATIQUES' } });

    const submitBtn = screen.getByRole('button', { name: /Créer et uploader/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/npc/submissions',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    await waitFor(() => {
      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(options.method).toBe('POST');
      const body = JSON.parse(options.body as string);
      expect(body).toMatchObject({
        studentId: 'stud-1',
        title: 'Bilan Printemps',
        subject: 'MATHEMATIQUES',
      });
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard/coach/npc/submissions/sub-123/upload');
    });
  });

  it('B. Cas erreur API', async () => {
    const user = userEvent.setup();
    const students = [{ id: 'stud-1', name: 'Alice Liddell' }];

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Erreur serveur API' }),
    }) as jest.Mock;

    render(<CreateSubmissionButton students={students} />);

    const openBtn = screen.getByRole('button', { name: /Nouvelle copie/i });
    await user.click(openBtn);

    const titleInput = screen.getByPlaceholderText('Ex: DS Maths - Fonctions dérivées');
    fireEvent.change(titleInput, { target: { value: 'Bilan Printemps' } });

    const selectElements = screen.getAllByTestId('mock-select');
    fireEvent.change(selectElements[1], { target: { value: 'MATHEMATIQUES' } });

    const submitBtn = screen.getByRole('button', { name: /Créer et uploader/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Erreur serveur API')).toBeInTheDocument();
    });
  });

  it('C. Cas champs manquants', async () => {
    const user = userEvent.setup();
    const students = [{ id: 'stud-1', name: 'Alice Liddell' }];

    render(<CreateSubmissionButton students={students} />);
    const openBtn = screen.getByRole('button', { name: /Nouvelle copie/i });
    await user.click(openBtn);

    const submitBtn = screen.getByRole('button', { name: /Créer et uploader/i });
    expect(submitBtn).toBeDisabled();

    // fill title only (subject still missing)
    const titleInput = screen.getByPlaceholderText('Ex: DS Maths - Fonctions dérivées');
    fireEvent.change(titleInput, { target: { value: 'Bilan' } });

    // button still disabled (needs subject)
    expect(submitBtn).toBeDisabled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('D. Cas plusieurs élèves', async () => {
    const user = userEvent.setup();
    const students = [
      { id: 'stud-1', name: 'Alice Liddell' },
      { id: 'stud-2', name: 'Bob Smith' },
    ];

    render(<CreateSubmissionButton students={students} />);
    const openBtn = screen.getByRole('button', { name: /Nouvelle copie/i });
    await user.click(openBtn);

    // No student preselected, so disabled
    const submitBtn = screen.getByRole('button', { name: /Créer et uploader/i });
    expect(submitBtn).toBeDisabled();
  });

  it('E. Cas réponse API invalide', async () => {
    const user = userEvent.setup();
    const students = [{ id: 'stud-1', name: 'Alice Liddell' }];

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ submission: {} }),
    }) as jest.Mock;

    render(<CreateSubmissionButton students={students} />);

    const openBtn = screen.getByRole('button', { name: /Nouvelle copie/i });
    await user.click(openBtn);

    const titleInput = screen.getByPlaceholderText('Ex: DS Maths - Fonctions dérivées');
    fireEvent.change(titleInput, { target: { value: 'Bilan Printemps' } });

    const selectElements = screen.getAllByTestId('mock-select');
    fireEvent.change(selectElements[1], { target: { value: 'MATHEMATIQUES' } });

    const submitBtn = screen.getByRole('button', { name: /Créer et uploader/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Réponse API invalide')).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });
});
