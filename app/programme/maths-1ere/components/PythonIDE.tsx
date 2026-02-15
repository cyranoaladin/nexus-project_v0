'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Pyodide-powered Python IDE component.
 * Loads Pyodide WebAssembly runtime on demand and executes Python code in-browser.
 */

interface PyodideRuntime {
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (opts: { batched: (msg: string) => void }) => void;
  setStderr: (opts: { batched: (msg: string) => void }) => void;
}

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideRuntime>;
  }
}

interface PythonIDEProps {
  /** Initial code to display in the editor */
  initialCode?: string;
  /** Expected output for auto-validation */
  expectedOutput?: string;
  /** Callback when code runs successfully */
  onSuccess?: () => void;
  /** Read-only mode */
  readOnly?: boolean;
}

export default function PythonIDE({
  initialCode = '# Écris ton code Python ici\nprint("Bonjour !")\n',
  expectedOutput,
  onSuccess,
  readOnly = false,
}: PythonIDEProps) {
  const [code, setCode] = useState(initialCode);
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pyodide, setPyodide] = useState<PyodideRuntime | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /** Load Pyodide on first run */
  const loadPyodideRuntime = useCallback(async (): Promise<PyodideRuntime> => {
    if (pyodide) return pyodide;

    setIsLoading(true);

    // Load Pyodide script if not already loaded
    if (!window.loadPyodide) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Échec du chargement de Pyodide'));
        document.head.appendChild(script);
      });
    }

    const py = await window.loadPyodide!({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/',
    });

    setPyodide(py);
    setIsLoading(false);
    return py;
  }, [pyodide]);

  /** Run the Python code */
  const runCode = useCallback(async () => {
    setIsRunning(true);
    setOutput('');
    setIsCorrect(null);

    try {
      const py = await loadPyodideRuntime();

      let stdout = '';
      let stderr = '';

      py.setStdout({
        batched: (msg: string) => {
          stdout += msg + '\n';
        },
      });
      py.setStderr({
        batched: (msg: string) => {
          stderr += msg + '\n';
        },
      });

      await py.runPythonAsync(code);

      const result = stdout.trimEnd();
      const errorResult = stderr.trimEnd();

      if (errorResult) {
        setOutput(`❌ Erreur:\n${errorResult}`);
        setIsCorrect(false);
      } else {
        setOutput(result || '(aucune sortie)');

        if (expectedOutput) {
          const match = result.trim() === expectedOutput.trim();
          setIsCorrect(match);
          if (match && onSuccess) onSuccess();
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setOutput(`❌ Erreur:\n${message}`);
      setIsCorrect(false);
    } finally {
      setIsRunning(false);
    }
  }, [code, expectedOutput, loadPyodideRuntime, onSuccess]);

  /** Handle Tab key for indentation */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const textarea = textareaRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newCode = code.substring(0, start) + '    ' + code.substring(end);
        setCode(newCode);
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 4;
        });
      }
    },
    [code]
  );

  /** Auto-resize textarea */
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [code]);

  return (
    <div className="bg-slate-900/80 border border-green-500/20 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800/80 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <span className="text-lg">🐍</span>
          <span className="text-sm font-bold text-green-400">Python IDE</span>
          {isLoading && (
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <span className="w-3 h-3 border border-green-500 border-t-transparent rounded-full animate-spin" />
              Chargement de Pyodide...
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setCode(initialCode);
              setOutput('');
              setIsCorrect(null);
            }}
            className="text-xs px-3 py-1 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
          >
            ↺ Reset
          </button>
          <button
            onClick={runCode}
            disabled={isRunning || isLoading}
            className={`text-xs px-4 py-1 rounded-lg font-bold transition-all ${
              isRunning || isLoading
                ? 'bg-slate-700 text-slate-500 cursor-wait'
                : 'bg-green-600 text-white hover:bg-green-500'
            }`}
          >
            {isRunning ? '⏳ Exécution...' : '▶ Exécuter'}
          </button>
        </div>
      </div>

      {/* Code Editor */}
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-10 bg-slate-800/50 flex flex-col items-end pr-2 pt-4 text-xs text-slate-600 font-mono select-none">
          {code.split('\n').map((_, i) => (
            <div key={i} className="leading-6">
              {i + 1}
            </div>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={handleKeyDown}
          readOnly={readOnly}
          spellCheck={false}
          className="w-full bg-transparent text-green-300 font-mono text-sm p-4 pl-12 focus:outline-none resize-none min-h-[120px] leading-6"
          style={{ tabSize: 4 }}
        />
      </div>

      {/* Output */}
      {output && (
        <div className={`border-t px-4 py-3 font-mono text-sm whitespace-pre-wrap ${
          isCorrect === true
            ? 'border-green-500/30 bg-green-900/10 text-green-300'
            : isCorrect === false
            ? 'border-red-500/30 bg-red-900/10 text-red-300'
            : 'border-slate-700 bg-slate-900/50 text-slate-300'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-slate-500">Sortie :</span>
            {isCorrect === true && <span className="text-xs text-green-400 font-bold">✓ Correct !</span>}
            {isCorrect === false && expectedOutput && (
              <span className="text-xs text-red-400 font-bold">✗ Attendu : {expectedOutput}</span>
            )}
          </div>
          {output}
        </div>
      )}
    </div>
  );
}
