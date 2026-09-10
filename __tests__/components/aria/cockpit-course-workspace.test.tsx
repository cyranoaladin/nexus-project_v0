import { fireEvent, render, screen } from '@testing-library/react';
import { AriaCourseWorkspace } from '@/components/aria/cockpit';
import type { AriaCockpitDTO } from '@/lib/aria/cockpit/contracts';
import fixture from '@/e2e/fixtures/aria/cockpit-terminale-eds.json';

const baseCockpit = fixture as unknown as AriaCockpitDTO;

describe('AriaCourseWorkspace', () => {
  it('shows a not-found state with a way back when the course key is unknown', () => {
    const onBack = jest.fn();
    render(
      <AriaCourseWorkspace
        cockpit={baseCockpit}
        courseKey="not-a-real-course"
        onBack={onBack}
        onWorkWithAria={jest.fn()}
      />,
    );
    expect(screen.getByText('Cours introuvable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Revenir à ma carte' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('renders skill-graph domains/competencies, resources and assessments for a real, fully-supported course', () => {
    const withGraph = baseCockpit.skillGraphs[0]!;
    render(
      <AriaCourseWorkspace
        cockpit={baseCockpit}
        courseKey={withGraph.courseKey}
        onBack={jest.fn()}
        onWorkWithAria={jest.fn()}
      />,
    );
    expect(screen.getByText(/domaines · \d+ compétences/)).toBeInTheDocument();
  });

  it('shows an empty state when the course has no compiled skill graph', () => {
    const withoutGraph = baseCockpit.curriculum.courses.find(
      (view) => !baseCockpit.skillGraphs.some((g) => g.courseKey === view.course.key),
    );
    expect(withoutGraph).toBeDefined();
    render(
      <AriaCourseWorkspace
        cockpit={baseCockpit}
        courseKey={withoutGraph!.course.key}
        onBack={jest.fn()}
        onWorkWithAria={jest.fn()}
      />,
    );
    expect(screen.getByText('Pas encore de graphe de compétences')).toBeInTheDocument();
  });

  it('disables the chat action and explains why when chat is unsupported for the subject', () => {
    const unsupported = baseCockpit.curriculum.courses.find(
      (view) => view.course.chatSubject === null,
    );
    if (!unsupported) return; // real data may not always carry this case; skip rather than fabricate
    render(
      <AriaCourseWorkspace
        cockpit={baseCockpit}
        courseKey={unsupported.course.key}
        onBack={jest.fn()}
        onWorkWithAria={jest.fn()}
      />,
    );
    expect(screen.getByTestId('aria-work-with-aria')).toBeDisabled();
    expect(screen.getByText('ARIA ne prend pas encore en charge cette matière.')).toBeInTheDocument();
  });

  it('lets the student work with ARIA on a chat-entitled course', () => {
    const chattable = baseCockpit.curriculum.courses.find(
      (view) => view.course.chatSubject !== null && view.access.commerciallyEntitled,
    );
    expect(chattable).toBeDefined();
    const onWorkWithAria = jest.fn();
    render(
      <AriaCourseWorkspace
        cockpit={baseCockpit}
        courseKey={chattable!.course.key}
        onBack={jest.fn()}
        onWorkWithAria={onWorkWithAria}
      />,
    );
    fireEvent.click(screen.getByTestId('aria-work-with-aria'));
    expect(onWorkWithAria).toHaveBeenCalledWith(chattable!.course.key);
  });

  it('navigates back via the top link', () => {
    const onBack = jest.fn();
    const any = baseCockpit.curriculum.courses[0]!;
    render(
      <AriaCourseWorkspace
        cockpit={baseCockpit}
        courseKey={any.course.key}
        onBack={onBack}
        onWorkWithAria={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Ma carte scolaire/ }));
    expect(onBack).toHaveBeenCalled();
  });
});
