import { MathJaxProvider } from './components/MathJaxProvider';
import MathsRevisionClient from './components/MathsRevisionClient';

/**
 * Spécialité Maths Première - Interactive Revision Page
 *
 * Features:
 * - Dashboard with progress tracking
 * - Interactive course sheets with MathJax rendering
 * - Quiz with instant feedback and score tracking
 *
 * Based on B.O. Éducation Nationale 2025-2026 programme.
 */
export default function MathsPremierePage() {
  return (
    <MathJaxProvider>
      <MathsRevisionClient />
    </MathJaxProvider>
  );
}
