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

function cockpit(courses: AriaCourseView[]): AriaCockpitDTO {
  return {
    curriculum: { courses },
    aria: { totalConversations: 4, messagesToday: 5, canUseAriaMaths: true, canUseAriaNsi: false },
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
});
