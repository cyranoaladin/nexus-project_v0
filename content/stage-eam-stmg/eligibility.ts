type StudentLike = Record<string, unknown> | null | undefined;

function normalize(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasPremiere(value: unknown): boolean {
  const text = normalize(value);
  return /\b(pre?miere|1ere|1re|premiere)\b/.test(text) || text.includes("premiere");
}

function hasStmg(value: unknown): boolean {
  const text = normalize(value);
  return (
    text.includes("stmg") ||
    text.includes("sciences et technologies du management et de la gestion")
  );
}

export function isPremiereStmg(student: StudentLike): boolean {
  if (!student || typeof student !== "object") return false;

  const levelFields = [
    student.gradeLevel,
    student.grade,
    student.niveau,
    student.classe,
    student.className,
    student.series,
    student.serie,
  ];
  const trackFields = [
    student.academicTrack,
    student.filiere,
    student.series,
    student.serie,
    student.classe,
    student.track,
    student.pathway,
  ];
  const combined = Object.values(student).join(" ");

  const levelOk = levelFields.some(hasPremiere) || hasPremiere(combined);
  const trackOk = trackFields.some(hasStmg) || hasStmg(combined);

  return levelOk && trackOk;
}
