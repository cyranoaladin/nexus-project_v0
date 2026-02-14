'use client';

import { useEffect, useCallback } from 'react';
import Script from 'next/script';

/**
 * MathJax configuration and provider component.
 * Loads MathJax v3 and provides a global typeset function.
 */
export function MathJaxProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script
        id="mathjax-config"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.MathJax = {
              tex: {
                inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
                displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']]
              },
              startup: {
                typeset: false
              }
            };
          `,
        }}
      />
      <Script
        id="mathjax-script"
        src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"
        strategy="afterInteractive"
      />
      {children}
    </>
  );
}

/**
 * Hook to trigger MathJax typesetting after content changes.
 */
export function useMathJax(deps: unknown[] = []) {
  const typeset = useCallback(() => {
    if (typeof window !== 'undefined' && window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise().catch((err: Error) => {
        console.error('MathJax typeset error:', err);
      });
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(typeset, 150);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeset, ...deps]);

  return typeset;
}

// Extend Window interface for MathJax
declare global {
  interface Window {
    MathJax?: {
      typesetPromise: () => Promise<void>;
      typeset?: () => void;
    };
  }
}
