/**
 * Official Education Nationale PDFs index — typed mapping consumed by the
 * student dashboard "Hub Ressources" (lot B+) and the streaming endpoint
 * GET /api/student/resources/official/[slug] (lot C).
 *
 * This file is the **single source of truth** for which PDFs are exposed to
 * which student profile. The actual builder (lot B) and route handler (lot C)
 * MUST use this mapping to:
 *   1. enforce the gating rules per (level × track),
 *   2. resolve `slug` → on-disk filename,
 *   3. emit consistent metadata to the UI.
 *
 * Lot A scope: stub only. Real entries are populated in lot B.
 *
 * Convention: slugs are kebab-case ASCII, unique across the entire mapping.
 */

import type { AcademicTrack, GradeLevel } from "@prisma/client";

export type OfficialPdfCategory = "PROGRAM" | "AUTOMATISMES" | "SUJET" | "EXEMPLE";
export type OfficialPdfSource = "MEN" | "NEXUS" | "PARTNER";
export type OfficialPdfTrackVisibility = AcademicTrack | "BOTH" | "ALL";

export type OfficialPdfSlug = string;

export interface OfficialPdfMetadata {
  /** Stable URL slug (kebab-case ASCII). Used in route /api/student/resources/official/[slug]. */
  readonly slug: OfficialPdfSlug;
  /** On-disk filename inside the resolved base directory. */
  readonly filename: string;
  /** Base directory relative to repo root (e.g. "programmes/automatismes-eds-premiere"). */
  readonly baseDir: string;
  /** Display title shown to the student. */
  readonly title: string;
  /** Optional subtitle / description for the resource card. */
  readonly description?: string;
  /** Editorial category. */
  readonly category: OfficialPdfCategory;
  /** Grade level visibility. */
  readonly level: GradeLevel;
  /**
   * Track visibility:
   * - a specific AcademicTrack value, or
   * - "BOTH" (EDS + STMG), or
   * - "ALL" (any track including STMG_NON_LYCEEN).
   */
  readonly track: OfficialPdfTrackVisibility;
  /** Provenance. */
  readonly source: OfficialPdfSource;
  /** ISO date when the document was published or last revised. */
  readonly publishedAt?: string;
  /** Approximate file size in bytes (informational). */
  readonly sizeBytes?: number;
}

/**
 * Lot A stub — empty mapping.
 *
 * Lot B will populate this with at minimum:
 *   - 6 PDFs from `programmes/automatismes-eds-premiere/` (EDS Première EDS_GENERALE)
 *   - Programme officiel Maths Première générale (currently in same dir)
 *   - STMG Première and Terminale EDS (when MEN PDFs are sourced)
 */
export const OFFICIAL_PDFS: Readonly<Record<OfficialPdfSlug, OfficialPdfMetadata>> =
  Object.freeze({} as Record<OfficialPdfSlug, OfficialPdfMetadata>);

/**
 * Resolve a PDF metadata entry by its slug.
 * Returns undefined if the slug is not registered.
 */
export function getOfficialPdf(slug: string): OfficialPdfMetadata | undefined {
  return OFFICIAL_PDFS[slug];
}

/**
 * List PDFs visible to a given (level × track) profile.
 *
 * Visibility rules:
 *   - level must match exactly,
 *   - track must match exactly OR be "BOTH" (EDS_GENERALE / STMG) OR be "ALL" (any track).
 */
export function listOfficialPdfsForProfile(
  level: GradeLevel,
  track: AcademicTrack,
): readonly OfficialPdfMetadata[] {
  return Object.values(OFFICIAL_PDFS).filter((pdf) => {
    if (pdf.level !== level) return false;
    if (pdf.track === "ALL") return true;
    if (pdf.track === "BOTH") {
      return track === "EDS_GENERALE" || track === "STMG" || track === "STMG_NON_LYCEEN";
    }
    return pdf.track === track;
  });
}

/**
 * Set of all registered slugs (for whitelist enforcement in the streaming route).
 */
export function getRegisteredSlugs(): ReadonlySet<OfficialPdfSlug> {
  return new Set(Object.keys(OFFICIAL_PDFS));
}
