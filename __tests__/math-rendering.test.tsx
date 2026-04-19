import React from 'react';
import { render, screen } from '@testing-library/react';
import { MathRichText } from '../app/programme/maths-1ere/components/MathContent';
import '@testing-library/jest-dom';

describe('Rendu Mathématique LaTeX', () => {
  it('doit rendre une formule inline correctement via KaTeX', () => {
    const content = "Calculer $x^2 + 2x + 1 = 0$";
    const { container } = render(<MathRichText content={content} />);
    
    // KaTeX génère des éléments avec la classe 'katex'
    const katexElement = container.querySelector('.katex');
    expect(katexElement).toBeInTheDocument();
    
    // Vérifie qu'il n'y a pas de texte brut avec les dollars
    expect(container.textContent).not.toContain('$x^2');
  });

  it('doit rendre une formule bloc correctement', () => {
    const content = "La formule est : \n $$f(x) = \int_0^\infty e^{-x} dx$$";
    const { container } = render(<MathRichText content={content} />);
    
    const katexDisplay = container.querySelector('.katex-display');
    expect(katexDisplay).toBeInTheDocument();
  });

  it('doit gérer les retours à la ligne <br />', () => {
    const content = "Ligne 1<br />Ligne 2";
    const { container } = render(<MathRichText content={content} />);
    
    expect(container.querySelector('br')).toBeInTheDocument();
  });

  it('doit nettoyer les délimiteurs LaTeX LLM standards \\[ \\]', () => {
    const content = "\\[ a^2 + b^2 = c^2 \\]";
    const { container } = render(<MathRichText content={content} />);
    
    expect(container.querySelector('.katex-display')).toBeInTheDocument();
    expect(container.textContent).not.toContain('\\[');
  });
});
