import { fireEvent, render, screen } from '@testing-library/react';
import { AriaChatPanel } from '@/components/aria/AriaChatPanel';
import { useAriaConversation } from '@/components/aria/useAriaConversation';

jest.mock('@/components/aria/useAriaConversation', () => ({
  useAriaConversation: jest.fn(),
}));

const courses = [
  {
    courseKey: 'eds-nsi-terminale',
    label: 'NSI',
    capabilities: { hasChat: true },
    access: { status: 'AVAILABLE', commerciallyEntitled: true, lockReason: null },
  },
  {
    courseKey: 'stmg-sgn-premiere',
    label: 'Sciences de gestion',
    capabilities: { hasChat: false },
    access: { status: 'AVAILABLE', commerciallyEntitled: true, lockReason: null },
  },
  {
    courseKey: 'eds-maths-terminale',
    label: 'Mathématiques',
    capabilities: { hasChat: true },
    access: { status: 'LOCKED', commerciallyEntitled: false, lockReason: 'NOT_ENTITLED' },
  },
];

function conversationState(overrides: Record<string, unknown> = {}) {
  return {
    courses,
    selectedCourseKey: 'eds-nsi-terminale',
    messages: [],
    input: '',
    phase: 'READY',
    announcement: 'ARIA est prête.',
    errorCode: null,
    ragStatus: null,
    showCitations: true,
    setInput: jest.fn(),
    selectCourse: jest.fn(),
    send: jest.fn(),
    stop: jest.fn(),
    submitFeedback: jest.fn(),
    ...overrides,
  };
}

describe('AriaChatPanel — one authenticated product engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAriaConversation as jest.Mock).mockReturnValue(conversationState());
  });

  it('ARIA-B-R008 THREAD_WIDGET_COURSE_FALLBACK renders the selected Academic Map course without a Maths default', () => {
    render(<AriaChatPanel open onClose={jest.fn()} />);
    expect(screen.getByLabelText('Cours ARIA')).toHaveValue('eds-nsi-terminale');
  });

  it('renders every Academic Map course and disables hasChat=false', () => {
    render(<AriaChatPanel open onClose={jest.fn()} />);
    expect(screen.getByRole('option', { name: /Sciences de gestion/ })).toBeDisabled();
  });

  it('disables commercially locked courses with an explicit reason', () => {
    render(<AriaChatPanel open onClose={jest.fn()} />);
    expect(screen.getByRole('option', { name: /Mathématiques.*non inclus/i })).toBeDisabled();
  });

  it('shows an explicit empty state when no course is available', () => {
    (useAriaConversation as jest.Mock).mockReturnValue(conversationState({
      courses: courses.slice(1), selectedCourseKey: null,
    }));
    render(<AriaChatPanel open onClose={jest.fn()} />);
    expect(screen.getByText(/aucun cours ARIA avec chat n’est disponible/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Message à ARIA')).toBeDisabled();
  });

  it('asks for an explicit course selection instead of defaulting to the first available course', () => {
    (useAriaConversation as jest.Mock).mockReturnValue(conversationState({
      selectedCourseKey: null,
    }));
    render(<AriaChatPanel open onClose={jest.fn()} />);
    expect(screen.getByRole('option', { name: 'Choisir un cours' })).toBeInTheDocument();
    expect(screen.getByText(/choisissez le cours/i)).toBeInTheDocument();
    expect(screen.queryByText(/aucun cours ARIA avec chat/i)).not.toBeInTheDocument();
  });

  it('delegates course changes to the sole conversation engine', () => {
    const state = conversationState();
    (useAriaConversation as jest.Mock).mockReturnValue(state);
    render(<AriaChatPanel open onClose={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('Cours ARIA'), { target: { value: 'eds-nsi-terminale' } });
    expect(state.selectCourse).toHaveBeenCalledWith('eds-nsi-terminale');
  });

  it('submits through the engine and never builds a second request in the component', () => {
    const state = conversationState({ input: 'Explique une pile.' });
    (useAriaConversation as jest.Mock).mockReturnValue(state);
    render(<AriaChatPanel open onClose={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer à ARIA' }));
    expect(state.send).toHaveBeenCalledTimes(1);
  });

  it('exposes a named Stop action only while streaming', () => {
    (useAriaConversation as jest.Mock).mockReturnValue(conversationState({ phase: 'STREAMING' }));
    render(<AriaChatPanel open onClose={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Arrêter la réponse ARIA' }));
    expect((useAriaConversation as jest.Mock).mock.results[0].value.stop).toHaveBeenCalled();
  });

  it('updates thumbs only after the canonical feedback flow resolves', async () => {
    const submitFeedback = jest.fn().mockResolvedValue(undefined);
    (useAriaConversation as jest.Mock).mockReturnValue(conversationState({
      submitFeedback,
      messages: [{
        id: 'message-1', role: 'assistant', content: 'Réponse', feedback: null,
        citations: [], status: 'COMPLETED',
      }],
    }));
    render(<AriaChatPanel open onClose={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Réponse utile' }));
    expect(submitFeedback).toHaveBeenCalledWith('message-1', true);
  });

  it('labels a preserved legacy citation as historical and unverified', () => {
    (useAriaConversation as jest.Mock).mockReturnValue(conversationState({
      messages: [{
        id: 'message-legacy', role: 'assistant', content: 'Réponse historique', feedback: null,
        status: 'COMPLETED',
        citations: [{
          traceability: 'LEGACY_UNTRACEABLE',
          id: 'citation-legacy',
          sourceTitle: 'Archive papier',
          sourceLocation: null,
        }],
      }],
    }));

    render(<AriaChatPanel open onClose={jest.fn()} />);

    expect(screen.getByText('1 référence historique')).toBeInTheDocument();
    expect(screen.getByText(/historique — provenance non vérifiée : Archive papier/i))
      .toBeInTheDocument();
    expect(screen.queryByText('1 source')).not.toBeInTheDocument();
  });

  it('keeps canonical and legacy citation counts distinct in a mixed history message', () => {
    (useAriaConversation as jest.Mock).mockReturnValue(conversationState({
      messages: [{
        id: 'message-mixed', role: 'assistant', content: 'Réponse mixte', feedback: null,
        status: 'COMPLETED',
        citations: [
          {
            traceability: 'CANONICAL', id: 'citation-canonical',
            sourceTitle: 'Programme officiel', sourceLocation: 'Page 2',
          },
          {
            traceability: 'LEGACY_UNTRACEABLE', id: 'citation-legacy',
            sourceTitle: 'Référence historique', sourceLocation: null,
          },
        ],
      }],
    }));

    render(<AriaChatPanel open onClose={jest.fn()} />);

    expect(screen.getByText('1 source vérifiée et 1 référence historique')).toBeInTheDocument();
    expect(screen.queryByText('2 références historiques')).not.toBeInTheDocument();
  });

  it('uses the canonical showCitations preference instead of exposing sources unconditionally', () => {
    (useAriaConversation as jest.Mock).mockReturnValue(conversationState({
      showCitations: false,
      messages: [{
        id: 'message-private-citations', role: 'assistant', content: 'Réponse', feedback: null,
        status: 'COMPLETED',
        citations: [{ id: 'citation-1', sourceTitle: 'Programme officiel', sourceLocation: 'Page 2' }],
      }],
    }));

    render(<AriaChatPanel open onClose={jest.fn()} />);

    expect(screen.queryByText('Programme officiel')).not.toBeInTheDocument();
    expect(screen.queryByText('1 source')).not.toBeInTheDocument();
  });
});
