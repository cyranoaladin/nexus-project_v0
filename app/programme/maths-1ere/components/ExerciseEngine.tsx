'use client';

import { useState, useEffect, useRef } from 'react';
import type { Exercice, ExerciceQCM, ExerciceNumerique, ExerciceOrdonnancement } from '../data';
import { useMathJax } from './MathJaxProvider';
import { areEquivalentAnswers } from '../lib/math-engine';

// ─── QCM Exercise ───────────────────────────────────────────────────────────

function QCMExercise({
  exercice,
  onCorrect,
  typeset,
}: {
  exercice: ExerciceQCM;
  onCorrect: () => void;
  typeset: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setSelected(null);
    setSubmitted(false);
  }, [exercice]);

  useEffect(() => {
    const t = setTimeout(typeset, 100);
    return () => clearTimeout(t);
  }, [submitted, typeset]);

  const handleSubmit = () => {
    if (selected === null) return;
    setSubmitted(true);
    if (selected === exercice.correct) onCorrect();
  };

  return (
    <div>
      <p className="text-slate-300 mb-4 font-medium">{exercice.question}</p>
      <div className="space-y-2 mb-4">
        {exercice.options.map((opt, i) => {
          let cls = 'border-slate-700 hover:border-cyan-500/50';
          if (submitted) {
            if (i === exercice.correct) cls = 'border-green-500 bg-green-500/10';
            else if (i === selected) cls = 'border-slate-500 bg-slate-500/10';
          } else if (i === selected) {
            cls = 'border-cyan-500 bg-cyan-500/10';
          }
          return (
            <button
              key={i}
              onClick={() => !submitted && setSelected(i)}
              disabled={submitted}
              className={`w-full text-left p-3 rounded-xl border transition-all text-sm font-mono ${cls} ${submitted ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <span className="text-slate-500 mr-2">{String.fromCharCode(65 + i)}.</span>
              {opt}
            </button>
          );
        })}
      </div>
      {!submitted ? (
        <button
          onClick={handleSubmit}
          disabled={selected === null}
          className="bg-cyan-600 text-white font-bold py-2 px-6 rounded-full hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
        >
          Valider
        </button>
      ) : (
        <div className={`p-3 rounded-xl text-sm ${selected === exercice.correct ? 'bg-green-500/10 border border-green-500/30' : 'bg-slate-500/10 border border-slate-500/30'}`}>
          <p className={`font-bold mb-1 ${selected === exercice.correct ? 'text-green-400' : 'text-slate-300'}`}>
            {selected === exercice.correct ? '✓ Correct !' : '✗ Incorrect'}
          </p>
          <p className="text-slate-300">{exercice.explication}</p>
        </div>
      )}
    </div>
  );
}

// ─── Numeric Exercise ───────────────────────────────────────────────────────

function NumericExercise({
  exercice,
  onCorrect,
  typeset,
}: {
  exercice: ExerciceNumerique;
  onCorrect: () => void;
  typeset: () => void;
}) {
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [errorHint, setErrorHint] = useState<string | null>(null);

  useEffect(() => {
    setValue('');
    setSubmitted(false);
    setIsCorrect(false);
    setErrorHint(null);
  }, [exercice]);

  useEffect(() => {
    const t = setTimeout(typeset, 100);
    return () => clearTimeout(t);
  }, [submitted, typeset]);

  const handleSubmit = () => {
    if (!value.trim()) return;
    const numVal = parseFloat(value.replace(',', '.'));
    const expectedRaw = String(exercice.reponse).replace(/\$/g, '');
    const expected = typeof exercice.reponse === 'number' ? exercice.reponse : parseFloat(expectedRaw.replace(',', '.'));
    const tol = exercice.tolerance ?? 0.001;
    const numericMatch = Number.isFinite(numVal) && Number.isFinite(expected) && Math.abs(numVal - expected) <= tol;
    const symbolicMatch = areEquivalentAnswers(value, expectedRaw);
    const correct = numericMatch || symbolicMatch;
    setIsCorrect(correct);
    setSubmitted(true);

    if (correct) {
      onCorrect();
      setErrorHint(null);
    } else {
      // ─── Error Profiling ────────────────────────────────────────
      let hint: string | null = null;

      // Sign error: student answered -expected
      if (expected !== 0 && Math.abs(numVal + expected) <= tol) {
        hint = '⚠️ Attention au signe ! Votre réponse a le signe opposé.';
      }
      // Factor error: student is off by an integer factor
      else if (expected !== 0 && numVal !== 0) {
        const ratio = numVal / expected;
        if (Math.abs(ratio - Math.round(ratio)) < 0.01 && Math.abs(ratio) >= 2 && Math.abs(ratio) <= 10) {
          hint = `⚠️ Vérifiez le coefficient ! Votre réponse semble être ×${Math.round(ratio)} la réponse attendue.`;
        }
        // Inverse error: student swapped numerator/denominator
        const invRatio = expected / numVal;
        if (!hint && Math.abs(invRatio - Math.round(invRatio)) < 0.01 && Math.abs(invRatio) >= 2 && Math.abs(invRatio) <= 10) {
          hint = '⚠️ Vérifiez l\'ordre ! Vous avez peut-être inversé numérateur et dénominateur.';
        }
        // Off by one
        if (!hint && Math.abs(numVal - expected) === 1) {
          hint = '⚠️ Presque ! Vous êtes à 1 près. Attention aux bornes et aux indices.';
        }
      }

      setErrorHint(hint);
    }
  };

  return (
    <div>
      <p className="text-slate-300 mb-4 font-medium">{exercice.question}</p>
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={value}
          onChange={(e) => !submitted && setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !submitted && handleSubmit()}
          disabled={submitted}
          placeholder="Votre réponse..."
          className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none disabled:opacity-60"
        />
        {exercice.unite && (
          <span className="text-slate-300 self-center text-sm">{exercice.unite}</span>
        )}
      </div>
      {!submitted ? (
        <button
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="bg-cyan-600 text-white font-bold py-2 px-6 rounded-full hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
        >
          Valider
        </button>
      ) : (
        <div className="space-y-2">
          <div className={`p-3 rounded-xl text-sm ${isCorrect ? 'bg-green-500/10 border border-green-500/30' : 'bg-slate-500/10 border border-slate-500/30'}`}>
            <p className={`font-bold mb-1 ${isCorrect ? 'text-green-400' : 'text-slate-300'}`}>
              {isCorrect ? '✓ Correct !' : `✗ Incorrect — Réponse attendue : ${exercice.reponse}`}
            </p>
            <p className="text-slate-300">{exercice.explication}</p>
          </div>
          {errorHint && (
            <div className="p-3 rounded-xl text-sm bg-blue-500/10 border border-blue-500/30">
              <p className="text-blue-300 font-bold">{errorHint}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Ordering Exercise (Drag & Drop) ────────────────────────────────────────

function OrderingExercise({
  exercice,
  onCorrect,
  typeset,
}: {
  exercice: ExerciceOrdonnancement;
  onCorrect: () => void;
  typeset: () => void;
}) {
  const [items, setItems] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  useEffect(() => {
    setItems([...exercice.etapesDesordre]);
    setSubmitted(false);
    setIsCorrect(false);
  }, [exercice]);

  useEffect(() => {
    const t = setTimeout(typeset, 100);
    return () => clearTimeout(t);
  }, [submitted, typeset]);

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const copy = [...items];
    const draggedItem = copy[dragItem.current];
    copy.splice(dragItem.current, 1);
    copy.splice(dragOverItem.current, 0, draggedItem);
    dragItem.current = null;
    dragOverItem.current = null;
    setItems(copy);
  };

  const moveItem = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const copy = [...items];
    const item = copy.splice(from, 1)[0];
    copy.splice(to, 0, item);
    setItems(copy);
  };

  const handleSubmit = () => {
    const correctOrder = exercice.ordreCorrect.map((i) => exercice.etapesDesordre[i]);
    const correct = items.every((item, i) => item === correctOrder[i]);
    setIsCorrect(correct);
    setSubmitted(true);
    if (correct) onCorrect();
  };

  return (
    <div>
      <p className="text-slate-300 mb-4 font-medium">{exercice.question}</p>
      <div className="space-y-2 mb-4">
        {items.map((item, i) => {
          let borderCls = 'border-slate-700';
          if (submitted) {
            const correctOrder = exercice.ordreCorrect.map((idx) => exercice.etapesDesordre[idx]);
            borderCls = item === correctOrder[i] ? 'border-green-500 bg-green-500/5' : 'border-slate-500 bg-slate-500/5';
          }
          return (
            <div
              key={`${item}-${i}`}
              draggable={!submitted}
              onDragStart={() => handleDragStart(i)}
              onDragEnter={() => handleDragEnter(i)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${borderCls} ${!submitted ? 'cursor-grab active:cursor-grabbing hover:border-cyan-500/50' : ''}`}
            >
              <span className="text-slate-500 font-bold text-sm w-6 text-center">{i + 1}</span>
              <span className="flex-1 text-sm text-slate-300">{item}</span>
              {!submitted && (
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveItem(i, i - 1)} className="text-slate-500 hover:text-white text-xs leading-none" aria-label="Monter">▲</button>
                  <button onClick={() => moveItem(i, i + 1)} className="text-slate-500 hover:text-white text-xs leading-none" aria-label="Descendre">▼</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!submitted ? (
        <button
          onClick={handleSubmit}
          className="bg-cyan-600 text-white font-bold py-2 px-6 rounded-full hover:bg-cyan-500 text-sm"
        >
          Valider l&apos;ordre
        </button>
      ) : (
        <div className={`p-3 rounded-xl text-sm ${isCorrect ? 'bg-green-500/10 border border-green-500/30' : 'bg-slate-500/10 border border-slate-500/30'}`}>
          <p className={`font-bold mb-1 ${isCorrect ? 'text-green-400' : 'text-slate-300'}`}>
            {isCorrect ? '✓ Ordre correct !' : '✗ Ordre incorrect'}
          </p>
          <p className="text-slate-300">{exercice.explication}</p>
        </div>
      )}
    </div>
  );
}

// ─── Exercise Engine (dispatcher) ───────────────────────────────────────────

export default function ExerciseEngine({
  exercices,
  chapId,
  onExerciseCorrect,
}: {
  exercices: Exercice[];
  chapId: string;
  onExerciseCorrect: (chapId: string, index: number) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const typeset = useMathJax([currentIndex, chapId]);

  useEffect(() => {
    setCurrentIndex(0);
  }, [chapId]);

  if (!exercices.length) return null;

  const ex = exercices[currentIndex];

  const handleCorrect = () => {
    onExerciseCorrect(chapId, currentIndex);
  };

  return (
    <div className="bg-slate-900 rounded-2xl p-6 border border-slate-700">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-white flex items-center gap-2">
          🧪 Exercices interactifs
        </h3>
        <div className="flex items-center gap-2">
          {exercices.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${i === currentIndex
                ? 'bg-cyan-500 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs text-slate-500 mb-3 uppercase tracking-wider">
        {ex.type === 'qcm' && 'QCM — Choix unique'}
        {ex.type === 'numerique' && 'Saisie numérique'}
        {ex.type === 'ordonnancement' && 'Ordonnancement — Glisser-déposer'}
      </div>

      {ex.type === 'qcm' && (
        <QCMExercise exercice={ex} onCorrect={handleCorrect} typeset={typeset} />
      )}
      {ex.type === 'numerique' && (
        <NumericExercise exercice={ex} onCorrect={handleCorrect} typeset={typeset} />
      )}
      {ex.type === 'ordonnancement' && (
        <OrderingExercise exercice={ex} onCorrect={handleCorrect} typeset={typeset} />
      )}
    </div>
  );
}
