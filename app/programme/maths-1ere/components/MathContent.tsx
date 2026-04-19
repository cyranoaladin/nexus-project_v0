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
 */
export const MathRichText: React.FC<{ content: string; className?: string }> = ({ content, className }) => {
  if (!content) return null;

  // Pre-process common LaTeX escape issues from LLMs
  const normalizedContent = content
    .replace(/\\\[/g, '$$$$')
    .replace(/\\\]/g, '$$$$')
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$');

  // Split by $$...$$ first (block), then by $...$ (inline)
  const parts = normalizedContent.split(/(\$\$[\s\S]*?\$\$|\$[^$]*?\$)/g);

  return (
    <div className={`leading-relaxed ${className}`}>
      {parts.map((part, index) => {
        if (!part) return null;

        if (part.startsWith('$$') && part.endsWith('$$')) {
          const math = part.slice(2, -2).trim();
          return <MathBlock key={index} math={math} />;
        }
        
        if (part.startsWith('$') && part.endsWith('$')) {
          const math = part.slice(1, -1).trim();
          return <MathInline key={index} math={math} />;
        }

        // Handle text with basic formatting
        return (
          <span key={index} className="whitespace-pre-wrap">
            {part.split(/(\*\*.*?\*\*|<br\s*\/?>|<code>.*?<\/code>|`[^`]+`)/gi).map((sub, sIdx) => {
              if (!sub) return null;

              if (sub.toLowerCase().startsWith('<br')) {
                return <br key={sIdx} />;
              }

              if (sub.startsWith('**') && sub.endsWith('**')) {
                return <strong key={sIdx} className="text-white font-bold">{sub.slice(2, -2)}</strong>;
              }

              if (sub.startsWith('<code>') && sub.endsWith('</code>')) {
                return (
                  <code key={sIdx} className="bg-slate-800 px-1.5 py-0.5 rounded text-cyan-300 font-mono text-[0.9em] border border-white/5">
                    {sub.slice(6, -7)}
                  </code>
                );
              }

              if (sub.startsWith('`') && sub.endsWith('`') && sub.length > 2) {
                return (
                  <code key={sIdx} className="bg-slate-800 px-1.5 py-0.5 rounded text-cyan-300 font-mono text-[0.9em] border border-white/5">
                    {sub.slice(1, -1)}
                  </code>
                );
              }

              return sub;
            })}
          </span>
        );
      })}
    </div>
  );
};
