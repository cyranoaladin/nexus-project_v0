import { fireEvent, render, screen } from '@testing-library/react';
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

it('closes on Escape and restores focus through its launcher contract', () => {
  const onClose = jest.fn();
  render(<AriaChatPanel open onClose={onClose} />);
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(1);
});
