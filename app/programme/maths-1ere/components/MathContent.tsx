'use client';

import React from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

interface MathProps {
  math: string;
  className?: string;
}

/**
 * Renders an inline mathematical formula using KaTeX.
 */
export const MathInline: React.FC<MathProps> = ({ math, className }) => {
  // Clean up potential double dollars if passed by mistake
  const cleanMath = math.replace(/^\$+|\$+$/g, '');
  return (
    <span className={className}>
      <InlineMath math={cleanMath} />
    </span>
  );
};

/**
 * Renders a block-level mathematical formula using KaTeX.
 */
export const MathBlock: React.FC<MathProps> = ({ math, className }) => {
  // Clean up potential double dollars
  const cleanMath = math.replace(/^\$\$+|\$\$+$/g, '');
  return (
    <div className={`my-4 overflow-x-auto overflow-y-hidden py-2 ${className}`}>
      <BlockMath math={cleanMath} />
    </div>
  );
};

/**
 * Parses a string containing mixed text and LaTeX (e.g., "The formula $x^2$ is...")
 * and renders it using KaTeX for formulas and span for text.
 * Also handles some basic HTML tags like <strong> and <br>.
 */
export const MathRichText: React.FC<{ content: string; className?: string }> = ({ content, className }) => {
  if (!content) return null;

  // First, handle some basic HTML tags if they are mixed in
  // Note: This is a simplified parser to avoid dangerouslySetInnerHTML
  const parts = content.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);

  return (
    <div className={className}>
      {parts.map((part, index) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          return <MathBlock key={index} math={part.slice(2, -2)} />;
        }
        if (part.startsWith('$') && part.endsWith('$')) {
          return <MathInline key={index} math={part.slice(1, -1)} />;
        }
        
        // Handle basic HTML-like strings if present (like <strong>)
        // This is a naive implementation, if content is very complex HTML, 
        // we might still need a sanitized dangerouslySetInnerHTML for the non-math parts
        // or a real HTML parser.
        const htmlParts = part.split(/(<[^>]+>)/g);
        return (
          <React.Fragment key={index}>
            {htmlParts.map((hPart, hIndex) => {
              if (hPart === '<br>' || hPart === '<br/>' || hPart === '<br />') return <br key={hIndex} />;
              if (hPart.startsWith('<strong>') && hPart.endsWith('</strong>')) {
                return <strong key={hIndex}>{hPart.slice(8, -9)}</strong>;
              }
              if (hPart.startsWith('<b>') && hPart.endsWith('</b>')) {
                return <b key={hIndex}>{hPart.slice(3, -4)}</b>;
              }
              // Skip other tags or render as text
              if (hPart.startsWith('<') && hPart.endsWith('>')) return null;
              return hPart;
            })}
          </React.Fragment>
        );
      })}
    </div>
  );
};
