'use client';

import { useState } from 'react';
import { ArrowRight, CheckCircle2, Sigma, XCircle } from 'lucide-react';
import { GENERATORS } from '../lib/exercise-generator';
import { areEquivalentAnswers } from '../lib/math-engine';
import { useMathsLabStore } from '../store';
import { MathRichText } from './MathContent';

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
    <div className="bg-slate-900/50 border border-green-500/20 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/10 rounded-lg">
            <Sigma className="h-5 w-5 text-green-300" aria-hidden="true" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">Exercice d&apos;entraînement infini</h3>
            <p className="text-[10px] text-green-500/70 font-bold uppercase tracking-widest">Paramètres aléatoires</p>
          </div>
        </div>
        {count > 0 && (
          <div className="px-3 py-1 bg-slate-800 rounded-full text-[10px] font-bold text-slate-400 border border-slate-700">
            {correct} / {count} réussis
          </div>
        )}
      </div>

      <div className="text-slate-200 text-lg mb-6 leading-relaxed">
        <MathRichText content={exercise.question} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          value={answer}
          onChange={(e) => !submitted && setAnswer(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !submitted && handleSubmit()}
          disabled={submitted}
          placeholder="Ta réponse..."
          className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-5 py-3 text-white font-mono focus:border-green-500 focus:outline-none disabled:opacity-60 transition-all shadow-inner"
          aria-label="Réponse exercice procédural"
        />
        {!submitted ? (
          <button 
            onClick={handleSubmit} 
            disabled={!answer.trim()} 
            className="bg-green-600 text-white font-bold py-3 px-8 rounded-xl hover:bg-green-500 disabled:opacity-40 transition-all shadow-lg shadow-green-600/10"
          >
            Valider
          </button>
        ) : (
          <button 
            onClick={newExercise} 
            className="bg-slate-700 text-white font-bold py-3 px-8 rounded-xl hover:bg-slate-600 transition-all inline-flex items-center justify-center gap-2"
          >
            Suivant <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {submitted && (
        <div className={`p-5 rounded-2xl border animate-in fade-in slide-in-from-top-2 duration-300 ${
          isCorrect ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`p-1.5 rounded-lg ${isCorrect ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {isCorrect ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            </div>
            <div className="flex-1">
              <p className={`font-bold mb-1 ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                {isCorrect ? 'Correct !' : 'Incorrect'}
              </p>
              {!isCorrect && (
                <div className="text-slate-300 text-sm mb-2 font-mono">
                  Réponse attendue : <MathRichText content={String(exercise.reponse)} />
                </div>
              )}
              <div className="text-slate-400 text-xs leading-relaxed">
                <MathRichText content={exercise.explication} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
