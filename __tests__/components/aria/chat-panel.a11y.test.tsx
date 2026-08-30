import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AriaChatPanel } from '@/components/aria/AriaChatPanel';
import { useAriaConversation } from '@/components/aria/useAriaConversation';

jest.mock('@/components/aria/useAriaConversation', () => ({ useAriaConversation: jest.fn() }));

beforeEach(() => {
  (useAriaConversation as jest.Mock).mockReturnValue({
    courses: [{
      courseKey: 'eds-nsi-terminale', label: 'NSI', capabilities: { hasChat: true },
      access: { status: 'AVAILABLE', commerciallyEntitled: true },
    }],
    selectedCourseKey: 'eds-nsi-terminale', messages: [], input: '', phase: 'READY',
    announcement: 'ARIA est prête.', errorCode: null, ragStatus: null,
    showCitations: true,
    setInput: jest.fn(), selectCourse: jest.fn(), send: jest.fn(), stop: jest.fn(),
    submitFeedback: jest.fn(),
  });
});

it('provides a semantic modal, labelled composer and non-spamming live region', () => {
  render(<AriaChatPanel open onClose={jest.fn()} />);
  expect(screen.getByRole('dialog', { name: 'Assistant pédagogique ARIA' })).toHaveAttribute('aria-modal', 'true');
  expect(screen.getByLabelText('Message à ARIA')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('ARIA est prête.');
});

it('closes on Escape even when focus has moved outside the dialog', () => {
  const onClose = jest.fn();
  render(
    <>
      <button type="button">Outside control</button>
      <AriaChatPanel open onClose={onClose} />
    </>,
  );
  screen.getByRole('button', { name: 'Outside control' }).focus();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('moves initial focus inside the dialog when the composer is disabled', async () => {
  (useAriaConversation as jest.Mock).mockReturnValue({
    courses: [{
      courseKey: 'stmg-sgn-premiere', label: 'Sciences de gestion', capabilities: { hasChat: false },
      access: { status: 'UNSUPPORTED', commerciallyEntitled: true },
    }],
    selectedCourseKey: null, messages: [], input: '', phase: 'READY',
    announcement: 'Aucun cours ARIA avec chat n’est disponible.', errorCode: null, ragStatus: null,
    showCitations: true,
    setInput: jest.fn(), selectCourse: jest.fn(), send: jest.fn(), stop: jest.fn(),
    submitFeedback: jest.fn(),
  });

  render(<AriaChatPanel open onClose={jest.fn()} />);

  await waitFor(() => expect(screen.getByLabelText('Cours ARIA')).toHaveFocus());
  expect(screen.getByLabelText('Message à ARIA')).toBeDisabled();
});

it('keeps citation and feedback controls at least 44 CSS pixels high', () => {
  (useAriaConversation as jest.Mock).mockReturnValue({
    courses: [{
      courseKey: 'eds-nsi-terminale', label: 'NSI', capabilities: { hasChat: true },
      access: { status: 'AVAILABLE', commerciallyEntitled: true },
    }],
    selectedCourseKey: 'eds-nsi-terminale',
    messages: [{
      id: 'assistant-1', role: 'assistant', content: 'Réponse', status: 'COMPLETED', feedback: null,
      citations: [{ id: 'citation-1', sourceTitle: 'Programme officiel' }],
    }],
    input: '', phase: 'READY', announcement: 'ARIA est prête.', errorCode: null, ragStatus: null,
    showCitations: true,
    setInput: jest.fn(), selectCourse: jest.fn(), send: jest.fn(), stop: jest.fn(),
    submitFeedback: jest.fn(),
  });

  render(<AriaChatPanel open onClose={jest.fn()} />);

  expect(screen.getByText('1 source')).toHaveClass('min-h-11');
  expect(screen.getByLabelText('Réponse utile')).toHaveClass('min-h-11', 'min-w-11');
  expect(screen.getByLabelText('Réponse peu utile')).toHaveClass('min-h-11', 'min-w-11');
});

it('traps Tab focus in both directions and restores the invoking control on close', async () => {
  (useAriaConversation as jest.Mock).mockReturnValue({
    courses: [{
      courseKey: 'eds-nsi-terminale', label: 'NSI', capabilities: { hasChat: true },
      access: { status: 'AVAILABLE', commerciallyEntitled: true },
    }],
    selectedCourseKey: 'eds-nsi-terminale', messages: [], input: 'Question', phase: 'READY',
    announcement: 'ARIA est prête.', errorCode: null, ragStatus: null, showCitations: true,
    setInput: jest.fn(), selectCourse: jest.fn(), send: jest.fn(), stop: jest.fn(),
    submitFeedback: jest.fn(),
  });
  const { rerender } = render(
    <>
      <button type="button">Open control</button>
      <AriaChatPanel open={false} onClose={jest.fn()} />
    </>,
  );
  const opener = screen.getByRole('button', { name: 'Open control' });
  opener.focus();
  rerender(
    <>
      <button type="button">Open control</button>
      <AriaChatPanel open onClose={jest.fn()} />
    </>,
  );
  await waitFor(() => expect(screen.getByLabelText('Message à ARIA')).toHaveFocus());

  const close = screen.getByRole('button', { name: 'Fermer ARIA' });
  const send = screen.getByRole('button', { name: 'Envoyer à ARIA' });
  close.focus();
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true });
  expect(send).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' });
  expect(close).toHaveFocus();

  rerender(<button type="button">Open control</button>);
  expect(screen.getByRole('button', { name: 'Open control' })).toHaveFocus();
});

it('ignores non-navigation keys inside the focus trap and non-Escape global keys', () => {
  const onClose = jest.fn();
  render(<AriaChatPanel open onClose={onClose} />);
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowDown' });
  fireEvent.keyDown(window, { key: 'Enter' });
  expect(onClose).not.toHaveBeenCalled();
});
