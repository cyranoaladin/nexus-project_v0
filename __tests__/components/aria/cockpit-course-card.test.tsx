import { fireEvent, render, screen } from '@testing-library/react';
import { AriaCourseCard } from '@/components/aria/cockpit/AriaCourseCard';
import type { AriaCourseView } from '@/lib/aria/cockpit/contracts';

function view(overrides: Partial<AriaCourseView['access']> = {}, courseOverrides: Partial<AriaCourseView['course']> = {}): AriaCourseView {
  return {
    course: {
      key: 'eds-maths-terminale',
      label: 'Mathématiques (spécialité)',
      shortLabel: 'Maths',
      gradeLevel: 'TERMINALE',
      role: 'SPECIALTY',
      chatSubject: 'MATHEMATIQUES',
      support: 'FULL',
      capabilities: { skillGraph: true, rag: true, resources: true, chat: true, chatSubjectIsApproximate: false },
      provenance: [],
      hasSkillGraph: true,
      ...courseOverrides,
    },
    access: {
      academicallyRelevant: true,
      productSupported: true,
      commerciallyEntitled: true,
      selectedForAria: false,
      ...overrides,
    },
  };
}

describe('AriaCourseCard', () => {
  it('renders an open course and calls onOpen when activated', () => {
    const onOpen = jest.fn();
    render(<AriaCourseCard view={view()} onOpen={onOpen} />);
    expect(screen.getByText('Maths')).toBeInTheDocument();
    expect(screen.getByText('Mathématiques (spécialité)')).toBeInTheDocument();
    expect(screen.getByText('Support complet')).toBeInTheDocument();
    expect(screen.getByText('Compétences')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir' }));
    expect(onOpen).toHaveBeenCalledWith('eds-maths-terminale');
  });

  it('preserves the V1 workspace action for an academically relevant course outside the commercial selection', () => {
    const onOpen = jest.fn();
    render(<AriaCourseCard view={view({ commerciallyEntitled: false })} onOpen={onOpen} />);
    expect(screen.getByText('Non inclus dans l’abonnement')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir' }));
    expect(onOpen).toHaveBeenCalledWith('eds-maths-terminale');
  });

  it('makes a locked course non-interactive in selectable mode', () => {
    const onToggle = jest.fn();
    render(
      <AriaCourseCard view={view({ commerciallyEntitled: false })} selectable onToggle={onToggle} />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('never exposes Ouvrir or calls onOpen for an academically irrelevant course with a global commercial grant', () => {
    const onOpen = jest.fn();
    render(
      <AriaCourseCard
        view={view({ academicallyRelevant: false, commerciallyEntitled: true })}
        onOpen={onOpen}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Ouvrir' })).not.toBeInTheDocument();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('never exposes Ajouter for an academically irrelevant course with a global commercial grant', () => {
    const onToggle = jest.fn();
    render(
      <AriaCourseCard
        view={view({ academicallyRelevant: false, commerciallyEntitled: true })}
        selectable
        onToggle={onToggle}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Ajouter à mon cockpit' })).not.toBeInTheDocument();
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('in selectable mode, toggles selection and reflects the selected state', () => {
    const onToggle = jest.fn();
    const { rerender } = render(
      <AriaCourseCard view={view({ selectedForAria: false })} selectable onToggle={onToggle} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter à mon cockpit' }));
    expect(onToggle).toHaveBeenCalledWith('eds-maths-terminale');

    rerender(<AriaCourseCard view={view({ selectedForAria: true })} selectable onToggle={onToggle} />);
    expect(screen.getByRole('button', { name: 'Retirer de mon cockpit' })).toBeInTheDocument();
  });

  it('renders an unsupported course as non-interactive regardless of selectable mode', () => {
    render(<AriaCourseCard view={view({ productSupported: false })} selectable />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('does not expose an active control when no action handler is wired', () => {
    render(<AriaCourseCard view={view({ selectedForAria: false })} selectable />);
    expect(screen.queryByRole('button', { name: 'Ajouter à mon cockpit' })).not.toBeInTheDocument();
  });

  it('shows a support note when provided', () => {
    render(
      <AriaCourseCard
        view={view({}, { supportNote: 'Ressources uniquement pour ce module.' })}
      />,
    );
    expect(screen.getByText('Ressources uniquement pour ce module.')).toBeInTheDocument();
  });
});
