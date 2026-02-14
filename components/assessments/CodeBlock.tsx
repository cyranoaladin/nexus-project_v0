/**
 * CodeBlock Component
 * 
 * Displays Python code with syntax highlighting and line numbers.
 * Used for NSI questions to show code snippets.
 */

'use client';

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  highlightLines?: number[];
  className?: string;
}

export function CodeBlock({
  code,
  language = 'python',
  showLineNumbers = true,
  highlightLines = [],
  className = '',
}: CodeBlockProps) {
  return (
    <div className={`relative rounded-lg overflow-hidden border border-slate-700 ${className}`}>
      {/* Language badge */}
      <div className="absolute top-2 right-2 z-10">
        <span className="px-2 py-1 text-xs font-mono bg-slate-800 text-slate-300 rounded border border-slate-600">
          {language.toUpperCase()}
        </span>
      </div>

      {/* Code */}
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        showLineNumbers={showLineNumbers}
        wrapLines={true}
        lineProps={(lineNumber) => {
          const isHighlighted = highlightLines.includes(lineNumber);
          return {
            style: {
              backgroundColor: isHighlighted ? 'rgba(255, 255, 0, 0.1)' : 'transparent',
              display: 'block',
              width: '100%',
            },
          };
        }}
        customStyle={{
          margin: 0,
          padding: '1rem',
          fontSize: '0.875rem',
          lineHeight: '1.5',
          backgroundColor: '#1e1e1e',
        }}
        lineNumberStyle={{
          minWidth: '2.5em',
          paddingRight: '1em',
          color: '#858585',
          userSelect: 'none',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

/**
 * Inline code component for small snippets
 */
export function InlineCode({ children }: { children: string }) {
  return (
    <code className="px-1.5 py-0.5 text-sm font-mono bg-slate-800 text-slate-200 rounded border border-slate-700">
      {children}
    </code>
  );
}
