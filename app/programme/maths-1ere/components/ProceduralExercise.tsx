'use client';

import { useState } from 'react';
import { GENERATORS } from '../lib/exercise-generator';
import { useMathJax } from './MathJaxProvider';
import { areEquivalentAnswers } from '../lib/math-engine';
import { useMathsLabStore } from '../store';

export default function ProceduralExercise({ chapId }: { chapId: string }) {
  const generator = GENERATORS[chapId] ?? GENERATORS['second-degre'];
  const isSupportedChapter = Boolean(GENERATORS[chapId]);

  const [exercise, setExercise] = useState(() => generator());
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [count, setCount] = useState(0);
  const [correct, setCorrect] = useState(0);
  const store = useMathsLabStore();
  useMathJax([exercise, submitted]);

  const newExercise = () => {
    setExercise(generator());
    setAnswer('');
    setSubmitted(false);
    setIsCorrect(false);
  };

  const handleSubmit = () => {
    if (!answer.trim() || submitted) return;
    const expected = String(exercise.reponse).replace(/\$/g, '');
    const numVal = parseFloat(answer.replace(',', '.'));
    const tol = exercise.tolerance ?? 0.001;
    const expectedNum = parseFloat(expected);
    const numMatch = Number.isFinite(numVal) && Number.isFinite(expectedNum) && Math.abs(numVal - expectedNum) <= tol;
    const symMatch = areEquivalentAnswers(answer, expected);
    const ok = numMatch || symMatch;
    setIsCorrect(ok);
    setSubmitted(true);
    setCount((c) => c + 1);
    if (ok) {
      setCorrect((c) => c + 1);
      store.incrementCombo();
      store.addXP(8);
    } else {
      store.resetCombo();
    }
  };

  if (!isSupportedChapter) return null;

  return (
    <div className="bg-slate-900/50 border border-green-500/20 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎲</span>
          <h3 className="font-bold text-green-300 text-sm">Exercice procédural</h3>
          <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">Paramètres aléatoires</span>
        </div>
        {count > 0 && <span className="text-xs text-slate-500">{correct}/{count} réussis</span>}
      </div>
      <p className="text-slate-200 font-medium mb-4">{exercise.question}</p>
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={answer}
          onChange={(e) => !submitted && setAnswer(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !submitted && handleSubmit()}
          disabled={submitted}
          placeholder="Ta réponse..."
          className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white font-mono focus:border-green-500 focus:outline-none disabled:opacity-60 text-sm"
          aria-label="Réponse exercice procédural"
        />
        {!submitted ? (
          <button onClick={handleSubmit} disabled={!answer.trim()} className="bg-green-600 text-white font-bold py-2 px-5 rounded-xl hover:bg-green-500 disabled:opacity-40 text-sm" aria-label="Valider la réponse procédurale">Valider</button>
        ) : (
          <button onClick={newExercise} className="bg-slate-700 text-white font-bold py-2 px-5 rounded-xl hover:bg-slate-600 text-sm" aria-label="Générer un nouvel exercice procédural">Suivant →</button>
        )}
      </div>
      {submitted && (
        <div className={`p-3 rounded-xl text-sm ${isCorrect ? 'bg-green-500/10 border border-green-500/30' : 'bg-slate-500/10 border border-slate-500/30'}`}>
          <p className={`font-bold mb-1 ${isCorrect ? 'text-green-400' : 'text-slate-300'}`}>
            {isCorrect ? '✓ Correct !' : `✗ Réponse : ${exercise.reponse}`}
          </p>
          <p className="text-slate-300 text-xs">{exercise.explication}</p>
        </div>
      )}
    </div>
  );
}
