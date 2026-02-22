/**
 * QuestionCard Component
 * 
 * Displays a question with automatic content detection:
 * - LaTeX formulas (for Maths)
 * - Code snippets (for NSI)
 * - Regular text
 */

'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { Question } from '@/lib/assessments/questions/types';
import { CodeBlock } from './CodeBlock';
import 'katex/dist/katex.min.css';

// Dynamic import of KaTeX to reduce bundle size
const TeX = dynamic(() => import('react-katex').then((mod) => mod.InlineMath), {
  ssr: false,
  loading: () => <span className="text-slate-300">Loading formula...</span>,
});

const BlockTeX = dynamic(() => import('react-katex').then((mod) => mod.BlockMath), {
  ssr: false,
  loading: () => <span className="text-slate-300">Loading formula...</span>,
});

interface QuestionCardProps {
  question: Question;
  selectedOption: string | null;
  onSelectOption: (optionId: string) => void;
  onSelectNSP: () => void;
  isNSP: boolean;
  questionNumber: number;
  totalQuestions: number;
  showHint?: boolean;
}

export function QuestionCard({
  question,
  selectedOption,
  onSelectOption,
  onSelectNSP,
  isNSP,
  questionNumber,
  totalQuestions,
  showHint = false,
}: QuestionCardProps) {
  const [hintVisible, setHintVisible] = useState(false);

  // Render question text with LaTeX support
  const renderQuestionText = (text: string) => {
    // Check if text contains LaTeX (inline: $...$ or display: $$...$$)
    const hasLatex = /\$.*?\$/.test(text);

    if (!hasLatex) {
      return <p className="text-lg text-slate-200">{text}</p>;
    }

    // Split text by LaTeX delimiters and render
    const parts = text.split(/(\$\$.*?\$\$|\$.*?\$)/g);

    return (
      <p className="text-lg text-slate-200">
        {parts.map((part, index) => {
          if (part.startsWith('$$') && part.endsWith('$$')) {
            // Display math
            const formula = part.slice(2, -2);
            return <BlockTeX key={index} math={formula} />;
          } else if (part.startsWith('$') && part.endsWith('$')) {
            // Inline math
            const formula = part.slice(1, -1);
            return <TeX key={index} math={formula} />;
          } else {
            return <span key={index}>{part}</span>;
          }
        })}
      </p>
    );
  };

  return (
    <div className="space-y-6">
      {/* Question header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 text-sm font-medium bg-primary/10 text-primary rounded-full">
            Question {questionNumber}/{totalQuestions}
          </span>
          <span className="px-2 py-1 text-xs font-mono bg-slate-800 text-slate-300 rounded border border-slate-700">
            {question.category}
          </span>
          {question.weight && (
            <span className="text-xs text-slate-300">
              {question.weight === 1 && '⭐ Facile'}
              {question.weight === 2 && '⭐⭐ Moyen'}
              {question.weight === 3 && '⭐⭐⭐ Difficile'}
            </span>
          )}
        </div>
      </div>

      {/* Question text */}
      <div className="space-y-4">
        {renderQuestionText(question.questionText)}

        {/* LaTeX formula (if present) */}
        {question.latexFormula && (
          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <BlockTeX math={question.latexFormula} />
          </div>
        )}

        {/* Code snippet (if present) */}
        {question.codeSnippet && (
          <CodeBlock code={question.codeSnippet} language="python" />
        )}

        {/* Image (if present) */}
        {question.imageUrl && (
          <div className="rounded-lg overflow-hidden border border-slate-700">
            <img
              src={question.imageUrl}
              alt="Question illustration"
              className="w-full h-auto"
            />
          </div>
        )}
      </div>

      {/* Options */}
      <div className="space-y-3">
        {question.options.map((option) => (
          <button
            key={option.id}
            onClick={() => onSelectOption(option.id)}
            disabled={isNSP}
            className={`
              w-full p-4 text-left rounded-lg border-2 transition-all
              ${
                selectedOption === option.id
                  ? 'border-primary bg-primary/10 text-white'
                  : 'border-slate-700 bg-slate-800/50 text-slate-200 hover:border-slate-600 hover:bg-slate-800'
              }
              ${isNSP ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            <div className="flex items-center gap-3">
              <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full border-2 border-current font-mono text-sm">
                {option.id.toUpperCase()}
              </span>
              <span className="flex-1">{option.text}</span>
            </div>
          </button>
        ))}
      </div>

      {/* NSP button */}
      <div className="pt-4 border-t border-dashed border-slate-700">
        <button
          onClick={onSelectNSP}
          className={`
            w-full p-3 rounded-lg border-2 transition-all
            ${
              isNSP
                ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                : 'border-slate-600 bg-transparent text-slate-300 hover:border-slate-500 hover:text-slate-200'
            }
          `}
        >
          <div className="flex items-center justify-center gap-2">
            <span className="text-lg">🤷</span>
            <span className="font-medium">Je n'ai pas encore vu cette notion</span>
          </div>
        </button>
      </div>

      {/* Hint (if available) */}
      {question.hint && showHint && (
        <div className="pt-4">
          {!hintVisible ? (
            <button
              onClick={() => setHintVisible(true)}
              className="text-sm text-primary hover:text-primary/80 transition-colors"
            >
              💡 Afficher l'indice
            </button>
          ) : (
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <span className="text-lg">💡</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-400 mb-1">Indice</p>
                  <p className="text-sm text-slate-300">{question.hint}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
