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

  // Split by $$...$$ first (block), then by $...$ (inline)
  // We use a non-capturing group for the split but keep the delimiters to identify them
  const parts = content.split(/(\$\$[\s\S]*?\$\$|\$[^$]*?\$)/g);

  return (
    <div className={className}>
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

        // For the text parts, we handle basic HTML tags
        // This is still a bit manual but safer than dangerouslySetInnerHTML
        // and more flexible than the previous version.
        const subParts = part.split(/(<[^>]+>)/g);
        
        return (
          <React.Fragment key={index}>
            {subParts.map((sub, sIdx) => {
              if (!sub) return null;
              
              if (sub.toLowerCase() === '<br>' || sub.toLowerCase() === '<br/>' || sub.toLowerCase() === '<br />') {
                return <br key={sIdx} />;
              }
              
              const markdownBoldMatch = sub.match(/\*\*(.*?)\*\*/g);
              if (markdownBoldMatch) {
                // This handles multiple bold parts in the same subpart
                const parts = sub.split(/(\*\*.*?\*\*)/g);
                return (
                  <React.Fragment key={sIdx}>
                    {parts.map((p, pIdx) => {
                      if (p.startsWith('**') && p.endsWith('**')) {
                        return <strong key={pIdx}>{p.slice(2, -2)}</strong>;
                      }
                      return p;
                    })}
                  </React.Fragment>
                );
              }

              const strongMatch = sub.match(/<(strong|b)>(.*?)<\/(strong|b)>/i);
              if (strongMatch) {
                return <strong key={sIdx}>{strongMatch[2]}</strong>;
              }
              
              const emMatch = sub.match(/<(em|i)>(.*?)<\/(em|i)>/i);
              if (emMatch) {
                return <em key={sIdx}>{emMatch[2]}</em>;
              }

              const codeMatch = sub.match(/<code>(.*?)<\/code>/i);
              if (codeMatch) {
                return <code key={sIdx} className="bg-slate-800 px-1 rounded text-cyan-300">{codeMatch[1]}</code>;
              }

              // If it's another tag we don't handle, we strip it to be safe
              if (sub.startsWith('<') && sub.endsWith('>')) {
                return null;
              }

              return sub;
            })}
          </React.Fragment>
        );
      })}
    </div>
  );
};
