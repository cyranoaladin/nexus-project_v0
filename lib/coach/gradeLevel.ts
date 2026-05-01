export interface StudentGradeLevel {
  gradeLevel?: string;
}

export function isPremiereLevel(student: StudentGradeLevel): boolean {
  const gradeLevel = student.gradeLevel?.toUpperCase() ?? '';
  return gradeLevel === 'PREMIERE';
}
