import type { AcademicTrack, GradeLevel } from '@prisma/client';
import type { AriaCurriculumDTO } from '@/lib/aria/cockpit/contracts';
import { toCanonicalAriaCourseKey } from '@/lib/aria/curriculum/course-key-aliases';
import { getCourse } from '@/lib/curriculum/catalog';

/** Execution needs the same exact curriculum identity as retrieval and prompts. */
export function isCoreV2AriaCourseExecutionSupported(
  courseKey: string,
  gradeLevel: GradeLevel | null,
  academicTrack: AcademicTrack | null,
): boolean {
  const course = getCourse(toCanonicalAriaCourseKey(courseKey));
  return Boolean(course && course.gradeLevel === gradeLevel
    && academicTrack && course.tracks.includes(academicTrack));
}

/** Keep school subjects visible without presenting an unavailable chat as usable. */
export function qualifyCoreV2AriaCurriculum(curriculum: AriaCurriculumDTO): AriaCurriculumDTO {
  const unsupported = new Set(curriculum.courses.filter(view => (
    !isCoreV2AriaCourseExecutionSupported(view.course.key,
      curriculum.academicProfile.gradeLevel, curriculum.academicProfile.academicTrack)
  )).map(view => view.course.key));
  return {
    ...curriculum,
    courses: curriculum.courses.map(view => unsupported.has(view.course.key) ? {
      ...view,
      course: {
        ...view.course,
        support: 'COMING_SOON',
        supportNote: 'Le chat ARIA n’est pas encore disponible pour ce cours.',
        capabilities: { ...view.course.capabilities, chat: false },
      },
      access: { ...view.access, productSupported: false },
    } : view),
    availableCourseKeys: curriculum.availableCourseKeys.filter(key => !unsupported.has(key)),
    lockedCourseKeys: curriculum.lockedCourseKeys.filter(key => !unsupported.has(key)),
    unsupportedCourseKeys: [...new Set([...curriculum.unsupportedCourseKeys,
      ...curriculum.courses.filter(view => view.access.academicallyRelevant
        && unsupported.has(view.course.key)).map(view => view.course.key)])],
  };
}
