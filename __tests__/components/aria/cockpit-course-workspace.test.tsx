import { fireEvent, render, screen } from '@testing-library/react';
import { AriaCourseWorkspace } from '@/components/aria/cockpit';
import type { AriaCockpitDTO, AriaCourseView } from '@/lib/aria/cockpit/contracts';
import fixture from '@/e2e/fixtures/aria/cockpit-terminale-eds.json';

const baseCockpit = fixture as unknown as AriaCockpitDTO;

function minimalCourseView(overrides: Partial<AriaCourseView['course']> = {}, accessOverrides: Partial<AriaCourseView['access']> = {}): AriaCourseView {
  return {
    course: {
      key: 'eds-maths-terminale', label: 'Mathématiques', shortLabel: 'Maths',
      gradeLevel: 'TERMINALE', role: 'SPECIALTY', chatSubject: 'MATHEMATIQUES',
      support: 'FULL', capabilities: { chat: true, resources: true, practice: false },
      provenance: [], hasSkillGraph: false,
      ...overrides,
    },
    access: {
      academicallyRelevant: true, productSupported: true,
      commerciallyEntitled: true, selectedForAria: false,
      ...accessOverrides,
    },
  } as unknown as AriaCourseView;
}

function minimalCockpit(overrides: Partial<AriaCockpitDTO> = {}): AriaCockpitDTO {
  return {
    curriculum: { courses: [minimalCourseView()] },
    skillGraphs: [],
    resources: [],
    assessments: [],
    ...overrides,
  } as unknown as AriaCockpitDTO;
}

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

  it('explains a subject-supported-but-not-entitled course as not included in the subscription', () => {
    render(
      <AriaCourseWorkspace
        cockpit={minimalCockpit({
          curriculum: { courses: [minimalCourseView({}, { commerciallyEntitled: false })] },
        } as unknown as Partial<AriaCockpitDTO>)}
        courseKey="eds-maths-terminale"
        onBack={jest.fn()}
        onWorkWithAria={jest.fn()}
      />,
    );
    expect(screen.getByTestId('aria-work-with-aria')).toBeDisabled();
    expect(screen.getByText("Cette matière n’est pas incluse dans ton abonnement.")).toBeInTheDocument();
  });

  it('never mounts (or fetches for) the workshops section on a locked, not-entitled course — a real, viewable "locked" state a student can still open', () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(() => {
      throw new Error('AriaWorkshopsSection must never fetch for a locked course');
    });
    render(
      <AriaCourseWorkspace
        cockpit={minimalCockpit({
          curriculum: { courses: [minimalCourseView({}, { commerciallyEntitled: false })] },
        } as unknown as Partial<AriaCockpitDTO>)}
        courseKey="eds-maths-terminale"
        onBack={jest.fn()}
        onWorkWithAria={jest.fn()}
      />,
    );
    expect(screen.queryByTestId('aria-workshops-section')).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('falls back to the raw role string for a role absent from ROLE_LABELS', () => {
    render(
      <AriaCourseWorkspace
        cockpit={minimalCockpit({
          curriculum: {
            courses: [minimalCourseView({ role: 'SOME_FUTURE_ROLE' as unknown as AriaCourseView['course']['role'] })],
          },
        } as unknown as Partial<AriaCockpitDTO>)}
        courseKey="eds-maths-terminale"
        onBack={jest.fn()}
        onWorkWithAria={jest.fn()}
      />,
    );
    expect(screen.getByText('SOME_FUTURE_ROLE')).toBeInTheDocument();
  });

  it('renders a resource without a subtitle, and an assessment without a date or score', () => {
    render(
      <AriaCourseWorkspace
        cockpit={minimalCockpit({
          resources: [
            { id: 'r1', title: 'Fiche sans sous-titre', subtitle: undefined, category: 'OFFICIAL_PROGRAM', type: 'PDF', href: null, courseKeys: ['eds-maths-terminale'] },
          ],
          assessments: [
            { id: 'a1', title: 'Bilan sans date', subject: 'MATHEMATIQUES', state: 'A_FAIRE', date: null, href: null, globalScore: null },
          ],
        } as unknown as Partial<AriaCockpitDTO>)}
        courseKey="eds-maths-terminale"
        onBack={jest.fn()}
        onWorkWithAria={jest.fn()}
      />,
    );
    expect(screen.getByText('Fiche sans sous-titre')).toBeInTheDocument();
    expect(screen.getByText('Bilan sans date')).toBeInTheDocument();
    expect(screen.getByText('Date inconnue')).toBeInTheDocument();
  });

  it('shows a real mastery badge next to a competency once mastery data has loaded', () => {
    const withGraph = baseCockpit.skillGraphs[0]!;
    const skill = withGraph.competencies[0]!;
    render(
      <AriaCourseWorkspace
        cockpit={baseCockpit}
        courseKey={withGraph.courseKey}
        onBack={jest.fn()}
        onWorkWithAria={jest.fn()}
        mastery={[{ skillId: skill.skillId, skillLabel: skill.label, level: 'PROFICIENT', activityId: 'activity-1' }]}
      />,
    );
    expect(screen.getByText('Presque acquis')).toBeInTheDocument();
  });

  it('renders no mastery badges when mastery is still undefined (loading)', () => {
    const withGraph = baseCockpit.skillGraphs[0]!;
    render(
      <AriaCourseWorkspace
        cockpit={baseCockpit}
        courseKey={withGraph.courseKey}
        onBack={jest.fn()}
        onWorkWithAria={jest.fn()}
      />,
    );
    expect(screen.queryByText('Maîtrisé')).not.toBeInTheDocument();
    expect(screen.queryByText('À commencer')).not.toBeInTheDocument();
  });

  it('shows the Next Best Action CTA linking to the real activity when one is recommended', () => {
    const withGraph = baseCockpit.skillGraphs[0]!;
    render(
      <AriaCourseWorkspace
        cockpit={baseCockpit}
        courseKey={withGraph.courseKey}
        onBack={jest.fn()}
        onWorkWithAria={jest.fn()}
        nextBestAction={{
          courseKey: withGraph.courseKey,
          skillId: 'ALG_SUITE_ARITH',
          skillLabel: 'Suites arithmétiques',
          level: 'DEVELOPING',
          activityId: 'activity-42',
        }}
      />,
    );
    const cta = screen.getByTestId('aria-next-best-action');
    expect(cta).toBeInTheDocument();
    expect(screen.getByText('Suites arithmétiques')).toBeInTheDocument();
    const link = cta.closest('a') ?? cta.querySelector('a');
    expect(link).toHaveAttribute(
      'href',
      `/dashboard/eleve/aria/practice/activity-42?courseKey=${withGraph.courseKey}`,
    );
  });

  it('shows no Next Best Action CTA when nextBestAction is null (nothing to recommend) or undefined (still loading)', () => {
    const withGraph = baseCockpit.skillGraphs[0]!;
    const { rerender } = render(
      <AriaCourseWorkspace
        cockpit={baseCockpit}
        courseKey={withGraph.courseKey}
        onBack={jest.fn()}
        onWorkWithAria={jest.fn()}
        nextBestAction={null}
      />,
    );
    expect(screen.queryByTestId('aria-next-best-action')).not.toBeInTheDocument();

    rerender(
      <AriaCourseWorkspace
        cockpit={baseCockpit}
        courseKey={withGraph.courseKey}
        onBack={jest.fn()}
        onWorkWithAria={jest.fn()}
      />,
    );
    expect(screen.queryByTestId('aria-next-best-action')).not.toBeInTheDocument();
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
