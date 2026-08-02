import { notFound } from 'next/navigation';

/**
 * The legacy runner loaded the complete question bank in the browser, including
 * correction markers. Keep the public route closed until the Canonical runner
 * specified by SPEC-04 replaces it.
 */
export default function BilanAssessmentPage(): never {
  notFound();
}
