import { GradeLevel, AcademicTrack } from '@prisma/client';

/**
 * Normalise une chaîne de caractères représentant un niveau scolaire
 * vers l'enum GradeLevel canonique.
 * 
 * @param input - La chaîne brute (ex: "3ème", "Première", "Terminale")
 * @returns Le GradeLevel correspondant ou null si inconnu
 */
export function normalizeGradeLevel(input: string | null | undefined): GradeLevel | null {
  if (!input) return null;

  const normalized = input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Supprime les accents

  // 3ème / Troisième
  if (
    normalized.includes('3') || 
    normalized.includes('trois') || 
    normalized.includes('college')
  ) {
    return GradeLevel.TROISIEME;
  }

  // Seconde
  if (normalized.includes('2nd') || normalized.includes('seconde')) {
    return GradeLevel.SECONDE;
  }

  // Première
  if (
    normalized.includes('1ere') || 
    normalized.includes('1re') || 
    normalized.includes('premiere') ||
    normalized.includes('first')
  ) {
    return GradeLevel.PREMIERE;
  }

  // Terminale
  if (
    normalized.includes('term') || 
    normalized.includes('tle') || 
    normalized.includes('derniere')
  ) {
    return GradeLevel.TERMINALE;
  }

  // Post-bac
  if (
    normalized.includes('post') || 
    normalized.includes('bac+') || 
    normalized.includes('sup') ||
    normalized.includes('licence') ||
    normalized.includes('prepa')
  ) {
    return GradeLevel.POSTBAC;
  }

  // Fallback direct sur l'enum si match exact (case insensitive)
  const enumValues = Object.values(GradeLevel) as string[];
  const match = enumValues.find(v => v.toLowerCase() === normalized);
  if (match) return match as GradeLevel;

  return null;
}

/**
 * Détermine le parcours académique par défaut en fonction du niveau.
 */
export function getDefaultTrackForLevel(level: GradeLevel): AcademicTrack {
  if (level === GradeLevel.TROISIEME) {
    return AcademicTrack.COLLEGE;
  }
  return AcademicTrack.EDS_GENERALE;
}

/**
 * Normalise à la fois le niveau et la filière depuis une chaîne brute.
 */
export function normalizeStudentLevelAndTrack(input: string | null | undefined): { level: GradeLevel; track: AcademicTrack } | null {
  const level = normalizeGradeLevel(input);
  if (!level) return null;

  let track = getDefaultTrackForLevel(level);

  if (input) {
    const normalized = input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalized.includes('stmg')) {
      track = AcademicTrack.STMG;
    } else if (normalized.includes('sti2d')) {
      track = AcademicTrack.STI2D;
    } else if (normalized.includes('st2s')) {
      track = AcademicTrack.ST2S;
    }
  }

  return { level, track };
}
