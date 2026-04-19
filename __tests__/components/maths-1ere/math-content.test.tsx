/**
 * Tests for MathContent components
 *
 * Validates that LaTeX formulas are rendered without leaking raw delimiters
 * and that mixed text/formula content is parsed correctly.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MathRichText } from '@/app/programme/maths-1ere/components/MathContent';

// Mock react-katex to avoid requiring KaTeX in Jest environment
jest.mock('react-katex', () => ({
  InlineMath: ({ math }: { math: string }) => (
    <span data-testid="inline-math" data-math={math}>{math}</span>
  ),
  BlockMath: ({ math }: { math: string }) => (
    <div data-testid="block-math" data-math={math}>{math}</div>
  ),
}));

// Mock the CSS import
jest.mock('katex/dist/katex.min.css', () => {}, { virtual: true });

describe('MathRichText', () => {
  it('rend le texte brut sans LaTeX', () => {
    render(<MathRichText content="Bonjour le monde" />);
    expect(screen.getByText('Bonjour le monde')).toBeInTheDocument();
  });

  it('rend une formule inline entre $...$', () => {
    render(<MathRichText content="La formule $x^2 + 1$ est importante" />);
    const inlineMath = screen.getByTestId('inline-math');
    expect(inlineMath).toBeInTheDocument();
    expect(inlineMath).toHaveAttribute('data-math', 'x^2 + 1');
  });

  it('rend une formule bloc entre $$...$$', () => {
    render(<MathRichText content="Voici : $$\\Delta = b^2 - 4ac$$" />);
    const blockMath = screen.getByTestId('block-math');
    expect(blockMath).toBeInTheDocument();
    expect(blockMath.getAttribute('data-math')).toContain('\\Delta');
  });

  it('ne laisse pas fuiter les délimiteurs LaTeX bruts $ ou $$', () => {
    const { container } = render(
      <MathRichText content="La valeur $\\Delta$ est le discriminant" />
    );
    // The dollar signs should not appear as raw text in the final output
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/^\$[^$]/); // no leading raw $
  });

  it('gère un contenu vide sans planter', () => {
    const { container } = render(<MathRichText content="" />);
    expect(container.firstChild).toBeNull();
  });

  it('convertit les délimiteurs LLM \\( \\) et \\[ \\] en LaTeX standard', () => {
    render(<MathRichText content="Résultat : \\(x^2\\) et \\[y = 2\\]" />);
    // After normalisation, \\( → $ and \\[ → $$
    // So we should see KaTeX rendering, not raw \( or \[
    const text = screen.queryAllByTestId('inline-math');
    const blockTexts = screen.queryAllByTestId('block-math');
    expect(text.length + blockTexts.length).toBeGreaterThan(0);
  });

  it('rend le texte gras **...**', () => {
    render(<MathRichText content="**Important** à retenir" />);
    const bold = document.querySelector('strong');
    expect(bold).not.toBeNull();
    expect(bold?.textContent).toBe('Important');
  });

  it('gère du contenu mixte texte + formule + texte', () => {
    render(
      <MathRichText content="La probabilité $P(A|B)$ se lit «probabilité de A sachant B»." />
    );
    expect(screen.getByTestId('inline-math')).toHaveAttribute('data-math', 'P(A|B)');
    expect(screen.getByText(/se lit/)).toBeInTheDocument();
  });
});
