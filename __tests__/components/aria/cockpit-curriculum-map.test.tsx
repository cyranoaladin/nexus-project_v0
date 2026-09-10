import { render, screen } from '@testing-library/react';
import { AriaCurriculumMap } from '@/components/aria/cockpit';
import type { AriaCourseView, AriaCurriculumDTO } from '@/lib/aria/cockpit/contracts';

function courseView(key: string, shortLabel: string, role: AriaCourseView['course']['role']): AriaCourseView {
  return {
    course: {
      key, label: shortLabel, shortLabel, gradeLevel: 'TERMINALE', role,
      chatSubject: null, support: 'FULL',
      capabilities: { chat: true, resources: true, practice: false },
      provenance: [], hasSkillGraph: false,
    },
    access: {
      academicallyRelevant: true, productSupported: true,
      commerciallyEntitled: true, selectedForAria: false,
    },
  } as unknown as AriaCourseView;
}

function curriculum(overrides: Partial<AriaCurriculumDTO> = {}): AriaCurriculumDTO {
  return {
    academicProfile: { incomplete: false, missingFields: [] },
    courses: [],
    availableCourseKeys: [],
    unsupportedCourseKeys: [],
    ...overrides,
  } as unknown as AriaCurriculumDTO;
}

describe('AriaCurriculumMap', () => {
  it('shows the incomplete-profile warning listing the missing fields, and renders nothing else', () => {
    render(
      <AriaCurriculumMap
        curriculum={curriculum({
          academicProfile: { incomplete: true, missingFields: ['academicTrack'] },
        } as unknown as Partial<AriaCurriculumDTO>)}
      />,
    );
    expect(screen.getByText('Ton profil scolaire est incomplet')).toBeInTheDocument();
    expect(screen.getByText(/academicTrack/)).toBeInTheDocument();
  });

  it('shows an empty state when no course matches the academic map', () => {
    render(<AriaCurriculumMap curriculum={curriculum()} />);
    expect(screen.getByText('Aucune matière connue pour ton profil')).toBeInTheDocument();
  });

  it('groups courses by role in the fixed display order, with plural counts', () => {
    render(
      <AriaCurriculumMap
        curriculum={curriculum({
          courses: [
            courseView('eds-maths-terminale', 'Maths', 'SPECIALTY'),
            courseView('philosophie-terminale', 'Philo', 'CORE'),
          ],
          availableCourseKeys: ['eds-maths-terminale', 'philosophie-terminale'],
          unsupportedCourseKeys: [],
        } as unknown as Partial<AriaCurriculumDTO>)}
      />,
    );
    const headings = screen.getAllByText(/Spécialité|Tronc commun/);
    expect(headings.map((el) => el.textContent)).toEqual(['Spécialité', 'Tronc commun']);
    expect(screen.getAllByText('Maths')).toHaveLength(2);
    expect(screen.getAllByText('Philo')).toHaveLength(2);
    expect(screen.getByText(/2 matières/)).toBeInTheDocument();
    expect(screen.getByText(/2 accessibles avec ARIA/)).toBeInTheDocument();
  });

  it('uses the singular form for a single course', () => {
    render(
      <AriaCurriculumMap
        curriculum={curriculum({
          courses: [courseView('eds-maths-terminale', 'Maths', 'SPECIALTY')],
          availableCourseKeys: ['eds-maths-terminale'],
          unsupportedCourseKeys: [],
        } as unknown as Partial<AriaCurriculumDTO>)}
      />,
    );
    expect(screen.getByText(/1 matière /)).toBeInTheDocument();
    expect(screen.getByText(/1 accessible /)).toBeInTheDocument();
  });
});
