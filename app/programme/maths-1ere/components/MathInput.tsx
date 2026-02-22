'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * MathLive-powered math input component.
 * Provides a virtual math keyboard for entering mathematical expressions.
 */

interface MathInputProps {
  /** Placeholder text */
  placeholder?: string;
  /** Callback with LaTeX value on change */
  onChange?: (latex: string) => void;
  /** Callback on submit (Enter key) */
  onSubmit?: (latex: string) => void;
  /** Initial LaTeX value */
  initialValue?: string;
  /** Read-only mode */
  readOnly?: boolean;
  /** CSS class for the container */
  className?: string;
}

export default function MathInput({
  placeholder = 'Tape ta réponse mathématique...',
  onChange,
  onSubmit,
  initialValue = '',
  readOnly = false,
  className = '',
}: MathInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mathfieldRef = useRef<HTMLElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [latex, setLatex] = useState(initialValue);

  /** Load MathLive and create the math-field element */
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Dynamic import of mathlive (it registers the <math-field> custom element)
        await import('mathlive');

        if (cancelled || !containerRef.current) return;

        // Create the math-field element
        const mf = document.createElement('math-field');
        mf.setAttribute('virtual-keyboard-mode', 'manual');
        mf.setAttribute('smart-mode', 'true');
        mf.setAttribute('smart-fence', 'true');
        mf.setAttribute('smart-superscript', 'true');
        mf.style.width = '100%';
        mf.style.fontSize = '1.1rem';
        mf.style.padding = '0.75rem 1rem';
        mf.style.background = 'transparent';
        mf.style.color = '#e2e8f0';
        mf.style.border = 'none';
        mf.style.outline = 'none';
        mf.style.minHeight = '48px';

        if (initialValue) {
          mf.setAttribute('value', initialValue);
        }

        if (readOnly) {
          mf.setAttribute('read-only', 'true');
        }

        // Listen for input events
        mf.addEventListener('input', () => {
          const val = (mf as unknown as { value: string }).value ?? '';
          setLatex(val);
          onChange?.(val);
        });

        // Listen for Enter key
        mf.addEventListener('keydown', (e: Event) => {
          const ke = e as KeyboardEvent;
          if (ke.key === 'Enter' && !ke.shiftKey) {
            ke.preventDefault();
            const val = (mf as unknown as { value: string }).value ?? '';
            onSubmit?.(val);
          }
        });

        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(mf);
        mathfieldRef.current = mf;
        setLoaded(true);
      } catch {
        // MathLive failed to load — fall back to text input
        setLoaded(false);
      }
    }

    init();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Fallback text input handler */
  const handleFallbackChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLatex(e.target.value);
      onChange?.(e.target.value);
    },
    [onChange]
  );

  const handleFallbackSubmit = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        onSubmit?.(latex);
      }
    },
    [latex, onSubmit]
  );

  /** Toggle virtual keyboard */
  const toggleKeyboard = useCallback(() => {
    if (mathfieldRef.current) {
      const mf = mathfieldRef.current as unknown as {
        executeCommand: (cmd: string) => void;
      };
      mf.executeCommand('toggleVirtualKeyboard');
    }
  }, []);

  return (
    <div className={`bg-slate-900/50 border border-blue-500/20 rounded-xl overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/50 border-b border-slate-700/30">
        <div className="flex items-center gap-2">
          <span className="text-sm">🔢</span>
          <span className="text-xs font-bold text-blue-300">Saisie mathématique</span>
        </div>
        {loaded && (
          <button
            onClick={toggleKeyboard}
            className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors"
            title="Clavier mathématique virtuel"
          >
            ⌨ Clavier
          </button>
        )}
      </div>

      {/* MathLive container or fallback */}
      <div ref={containerRef} className="min-h-[48px]">
        {!loaded && (
          <input
            type="text"
            value={latex}
            onChange={handleFallbackChange}
            onKeyDown={handleFallbackSubmit}
            readOnly={readOnly}
            placeholder={placeholder}
            className="w-full bg-transparent text-white font-mono text-sm px-4 py-3 focus:outline-none"
          />
        )}
      </div>

      {/* LaTeX preview */}
      {latex && (
        <div className="px-3 py-1.5 border-t border-slate-700/30 text-xs text-slate-300 font-mono truncate">
          LaTeX: {latex}
        </div>
      )}
    </div>
  );
}
