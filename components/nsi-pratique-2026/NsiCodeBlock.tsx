'use client';

import { useState, useCallback, useMemo } from 'react';
import { Copy, Check } from 'lucide-react';

interface NsiCodeBlockProps {
  code: string;
  language?: string;
}

const PYTHON_KEYWORDS = new Set([
  'def', 'class', 'return', 'if', 'else', 'elif', 'for', 'while',
  'import', 'from', 'True', 'False', 'None', 'and', 'or', 'not',
  'in', 'is', 'assert', 'break', 'continue', 'try', 'except',
  'raise', 'with', 'as', 'lambda', 'yield', 'pass', 'del', 'global',
  'nonlocal', 'finally',
]);

const BUILTIN_KEYWORDS = new Set([
  'print', 'len', 'range', 'int', 'float', 'str', 'list', 'dict',
  'set', 'tuple', 'bool', 'sum', 'min', 'max', 'abs', 'sorted',
  'enumerate', 'zip', 'map', 'filter', 'open', 'isinstance', 'type',
  'all', 'any', 'format', 'round', 'input', 'super', 'property',
]);

interface Token {
  type: 'keyword' | 'builtin' | 'string' | 'comment' | 'number' | 'decorator' | 'plain';
  value: string;
}

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < line.length) {
    // Comments
    if (line[i] === '#') {
      tokens.push({ type: 'comment', value: line.slice(i) });
      break;
    }

    // Strings (single or double quotes)
    if (line[i] === '"' || line[i] === "'") {
      const quote = line[i];
      // Check for triple quotes
      const isTriple = line.slice(i, i + 3) === quote.repeat(3);
      const endPattern = isTriple ? quote.repeat(3) : quote;
      const start = i;
      i += isTriple ? 3 : 1;

      while (i < line.length) {
        if (line[i] === '\\') {
          i += 2;
          continue;
        }
        if (line.slice(i, i + endPattern.length) === endPattern) {
          i += endPattern.length;
          break;
        }
        i++;
      }
      tokens.push({ type: 'string', value: line.slice(start, i) });
      continue;
    }

    // Decorator
    if (line[i] === '@' && (i === 0 || /\s/.test(line[i - 1]))) {
      let j = i + 1;
      while (j < line.length && /[\w.]/.test(line[j])) j++;
      tokens.push({ type: 'decorator', value: line.slice(i, j) });
      i = j;
      continue;
    }

    // Numbers
    if (/\d/.test(line[i]) && (i === 0 || /[\s([\-+*/%=<>!,:]/.test(line[i - 1]))) {
      let j = i;
      while (j < line.length && /[\d.xXoObBeE_]/.test(line[j])) j++;
      tokens.push({ type: 'number', value: line.slice(i, j) });
      i = j;
      continue;
    }

    // Words (keywords, builtins, identifiers)
    if (/[a-zA-Z_]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[\w]/.test(line[j])) j++;
      const word = line.slice(i, j);

      if (PYTHON_KEYWORDS.has(word)) {
        tokens.push({ type: 'keyword', value: word });
      } else if (BUILTIN_KEYWORDS.has(word)) {
        tokens.push({ type: 'builtin', value: word });
      } else {
        tokens.push({ type: 'plain', value: word });
      }
      i = j;
      continue;
    }

    // Other characters
    tokens.push({ type: 'plain', value: line[i] });
    i++;
  }

  return tokens;
}

const TOKEN_CLASSES: Record<Token['type'], string> = {
  keyword: 'text-purple-400',
  builtin: 'text-blue-400',
  string: 'text-emerald-400',
  comment: 'text-neutral-500 italic',
  number: 'text-amber-400',
  decorator: 'text-cyan-400',
  plain: 'text-neutral-200',
};

function HighlightedLine({ line }: { line: string }) {
  const tokens = useMemo(() => tokenizeLine(line), [line]);

  return (
    <>
      {tokens.map((token, i) => (
        <span key={i} className={TOKEN_CLASSES[token.type]}>
          {token.value}
        </span>
      ))}
    </>
  );
}

export function NsiCodeBlock({ code, language = 'python' }: NsiCodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [code]);

  const lines = code.split('\n');

  return (
    <div className="relative group rounded-lg border border-white/10 bg-surface-darker overflow-hidden">
      {/* Language label + copy button */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-elevated/50 border-b border-white/5">
        <span className="text-[10px] text-neutral-500 font-mono uppercase">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors"
          aria-label="Copier le code"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-semantic-success" />
              <span className="text-semantic-success">Copié</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copier</span>
            </>
          )}
        </button>
      </div>

      {/* Code */}
      <div className="overflow-x-auto">
        <pre className="p-3 text-xs leading-5 font-mono">
          <code>
            {lines.map((line, i) => (
              <div key={i} className="flex">
                <span className="inline-block w-8 text-right text-neutral-600 select-none pr-3 shrink-0">
                  {i + 1}
                </span>
                <span className="flex-1">
                  <HighlightedLine line={line} />
                </span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}
