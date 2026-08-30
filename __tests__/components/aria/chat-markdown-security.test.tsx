import { render, screen } from '@testing-library/react';
import { AriaChatPanel } from '@/components/aria/AriaChatPanel';
import { useAriaConversation } from '@/components/aria/useAriaConversation';

jest.mock('@/components/aria/useAriaConversation', () => ({ useAriaConversation: jest.fn() }));

it('renders hostile assistant Markdown/HTML as inert text and canonical citations as controls', () => {
  (useAriaConversation as jest.Mock).mockReturnValue({
    courses: [{
      courseKey: 'eds-nsi-terminale', label: 'NSI', capabilities: { hasChat: true },
      access: { status: 'AVAILABLE', commerciallyEntitled: true },
    }],
    selectedCourseKey: 'eds-nsi-terminale',
    messages: [{
      id: 'message-1', role: 'assistant',
      content: '<img src=x onerror=alert(1)> [vol](javascript:alert(1))',
      feedback: null, status: 'COMPLETED',
      citations: [{ id: 'citation-1', sourceTitle: 'Programme officiel', sourceLocation: 'p. 3' }],
    }],
    input: '', phase: 'READY', announcement: '', errorCode: null, ragStatus: 'SUCCESS',
    showCitations: true,
    setInput: jest.fn(), selectCourse: jest.fn(), send: jest.fn(), stop: jest.fn(),
    submitFeedback: jest.fn(),
  });
  const { container } = render(<AriaChatPanel open onClose={jest.fn()} />);
  expect(screen.getByText(/<img src=x/)).toBeInTheDocument();
  expect(container.querySelector('img')).toBeNull();
  expect(container.querySelector('a')).toBeNull();
  expect(screen.getByText(/Programme officiel/)).toBeInTheDocument();
});
