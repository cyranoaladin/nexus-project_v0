import { fireEvent, render, screen } from '@testing-library/react';
import { AriaAgentPanel } from '@/components/aria/cockpit';
import type { AriaCockpitDTO, AriaCourseView } from '@/lib/aria/cockpit/contracts';

function chattableCourse(key: string, shortLabel: string, entitled = true): AriaCourseView {
  return {
    course: {
      key,
      label: shortLabel,
      shortLabel,
      gradeLevel: 'TERMINALE',
      role: 'SPECIALTY',
      chatSubject: 'MATHEMATICS',
      support: 'FULL',
      capabilities: { chat: true, resources: true, practice: false },
      provenance: [],
      hasSkillGraph: false,
    },
    access: {
      academicallyRelevant: true,
      productSupported: true,
      commerciallyEntitled: entitled,
      selectedForAria: false,
    },
  } as unknown as AriaCourseView;
}

function cockpit(courses: AriaCourseView[], chat = true): AriaCockpitDTO {
  return {
    curriculum: { courses },
    aria: { totalConversations: 4, messagesToday: 5, canUseAriaMaths: true, canUseAriaNsi: false },
    capabilities: {
      chat,
      trajectory: true,
      assessments: true,
      resources: true,
      nextSession: true,
      conversationHistory: true,
    },
  } as unknown as AriaCockpitDTO;
}

describe('AriaAgentPanel', () => {
  it('shows an empty state when no course is entitled to chat', () => {
    render(<AriaAgentPanel cockpit={cockpit([chattableCourse('m', 'Maths', false)])} onOpenChat={jest.fn()} />);
    expect(screen.getByText('Aucune matière ouverte pour ARIA')).toBeInTheDocument();
  });

  it('lists entitled chattable courses and opens chat on click', () => {
    const onOpenChat = jest.fn();
    render(
      <AriaAgentPanel
        cockpit={cockpit([chattableCourse('eds-maths-terminale', 'Maths'), chattableCourse('nsi', 'NSI')])}
        onOpenChat={onOpenChat}
      />,
    );
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Maths/ }));
    expect(onOpenChat).toHaveBeenCalledWith('eds-maths-terminale');
  });

  it('does not offer chat for an academically irrelevant course even when commercially entitled', () => {
    const onOpenChat = jest.fn();
    const source = chattableCourse('maths-complementaires-terminale', 'Maths complémentaires');
    const irrelevant = {
      ...source,
      access: { ...source.access, academicallyRelevant: false },
    } as AriaCourseView;

    render(<AriaAgentPanel cockpit={cockpit([irrelevant])} onOpenChat={onOpenChat} />);

    expect(screen.getByText('Aucune matière ouverte pour ARIA')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Maths complémentaires/ })).not.toBeInTheDocument();
    expect(onOpenChat).not.toHaveBeenCalled();
  });

  it('renders a neutral unavailable state and no chat action when chat is not deployed', () => {
    render(<AriaAgentPanel cockpit={cockpit([chattableCourse('m', 'Maths')], false)} />);

    expect(screen.getByText('Le chat ARIA n’est pas encore disponible pour ce profil.')).toBeInTheDocument();
    expect(screen.queryByText('Démarrer une conversation')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Maths/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/abonnement/i)).not.toBeInTheDocument();
  });

  it('fails closed without rendering an active course button when the chat callback is absent', () => {
    render(<AriaAgentPanel cockpit={cockpit([chattableCourse('m', 'Maths')])} />);

    expect(screen.getByText('Chat ARIA indisponible')).toBeInTheDocument();
    expect(screen.queryByText('Démarrer une conversation')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Maths/ })).not.toBeInTheDocument();
  });
});
