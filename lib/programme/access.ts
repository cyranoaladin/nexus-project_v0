/**
 * Access control utilities for official PDFs
 * Provides consistent track/level gating between Hub builder and API route
 */

import type { AcademicTrack, GradeLevel } from '@prisma/client';
import type { OfficialPdfMetadata } from './official-pdfs';

/**
 * Student profile subset needed for PDF access decisions
 */
export type StudentAccessProfile = {
  gradeLevel: GradeLevel;
  academicTrack: AcademicTrack;
};

/**
 * Determines if a student can access a specific official PDF
 * 
 * Rules:
 * - Track must match OR be BOTH (universal access)
 * - STMG_NON_LYCEEN is normalized to STMG for comparison
 * - Level must match exactly (no cross-level access)
 * 
 * @param meta - The PDF metadata from OFFICIAL_PDFS
 * @param profile - The student's access profile
 * @returns true if access is allowed, false otherwise
 */
export function isOfficialPdfAllowedFor(
  meta: OfficialPdfMetadata,
  profile: StudentAccessProfile
): boolean {
  // Normalize STMG_NON_LYCEEN to STMG for track comparison
  const normalizedTrack: AcademicTrack =
    profile.academicTrack === 'STMG_NON_LYCEEN' ? 'STMG' : profile.academicTrack;

  // Track check: BOTH allows all tracks, otherwise must match
  const trackOk = meta.track === 'BOTH' || meta.track === normalizedTrack;

  // Level check: must match exactly (no cross-level access)
  const levelOk = meta.level === profile.gradeLevel;

  return trackOk && levelOk;
}
