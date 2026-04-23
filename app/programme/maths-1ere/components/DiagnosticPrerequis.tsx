'use client';
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Search, BookOpen } from 'lucide-react';

interface PrerequisQuestion {
  question: string;
  options: string[];
  correct: number;
  remediation: string;
}

interface DiagnosticProps {
  chapId: string;
  questions: PrerequisQuestion[];
  onComplete: (score: number, total: number) => void;
  onNavigateToChap?: (chapId: string) => void;
}

export default function DiagnosticPrerequis({ chapId, questions, onComplete, onNavigateToChap }: DiagnosticProps) {
  const [phase, setPhase] = useState<'intro' | 'quiz' | 'result'>('intro');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || questions.length === 0) return null;

  const score = answers.filter((a, i) => a === questions[i].correct).length;

  // F43: Track which questions were failed for remediation
  const failedQuestions = answers.map((a, i) => ({ answer: a, question: questions[i] }))
    .filter(({ answer, question }) => answer !== question.correct);
  const remediationsNeeded = [...new Set(failedQuestions.map(fq => fq.question.remediation))];

  const handleAnswer = (choice: number) => {
    const newAnswers = [...answers, choice];
    setAnswers(newAnswers);
    if (index + 1 < questions.length) {
      setIndex(index + 1);
    } else {
      const finalScore = newAnswers.filter((a, i) => a === questions[i].correct).length;
      setPhase('result');
      onComplete(finalScore, questions.length);
    }
  };

  if (phase === 'intro') {
    return (
      <div className="bg-gradient-to-r from-slate-800/80 to-slate-900 border border-blue-500/20 rounded-2xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-2"><Search className="h-5 w-5 text-blue-300" aria-hidden="true" /><h3 className="font-bold text-blue-200 text-sm">Pour prendre un bon départ</h3><span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">{questions.length} questions</span></div>
        <p className="text-xs text-slate-400 mb-4">Vérifie tes prérequis avant ce chapitre. Diagnostic non noté.</p>
        <div className="flex gap-2">
          <button onClick={() => setPhase('quiz')} className="text-xs px-4 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-500" aria-label={`Commencer le diagnostic du chapitre ${chapId}`}>Commencer le diagnostic</button>
          <button onClick={() => setDismissed(true)} className="text-xs px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600" aria-label="Passer le diagnostic">Passer</button>
        </div>
      </div>
    );
  }

  if (phase === 'quiz') {
    const q = questions[index];
    return (
      <div className="bg-slate-800/80 border border-blue-500/20 rounded-2xl p-5 mb-4">
        <div className="flex justify-between items-center mb-3"><span className="text-xs text-slate-500">Prérequis {index + 1}/{questions.length}</span><div className="w-32 h-1.5 bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(index / questions.length) * 100}%` }} /></div></div>
        <p className="text-sm text-white font-medium mb-4">{q.question}</p>
        <div className="space-y-2">
          {q.options.map((opt, i) => (
            <button key={`${q.question}-${i}`} onClick={() => handleAnswer(i)} className="w-full text-left p-3 rounded-xl border border-slate-700 hover:border-blue-500 hover:bg-blue-500/5 text-slate-300 text-sm transition-all" aria-label={`Réponse ${String.fromCharCode(65 + i)}`}> 
              <span className="text-slate-500 mr-2">{String.fromCharCode(65 + i)}.</span>{opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`border rounded-2xl p-5 mb-4 ${score >= questions.length * 0.7 ? 'bg-green-500/5 border-green-500/30' : 'bg-amber-500/5 border-amber-500/30'}`}>
      <div className="flex items-center gap-2 mb-2">{score >= questions.length * 0.7 ? <CheckCircle2 className="h-5 w-5 text-green-400" aria-hidden="true" /> : <AlertTriangle className="h-5 w-5 text-amber-400" aria-hidden="true" />}<h3 className="font-bold text-white text-sm">Diagnostic : {score}/{questions.length}</h3></div>
      {score >= questions.length * 0.7 ? <p className="text-xs text-green-300">Pré-requis solides. Tu peux avancer.</p> : (
        <>
          <p className="text-xs text-amber-300 mb-3">Quelques prérequis à consolider avant de poursuivre.</p>
          {/* F43: Remediation links */}
          {remediationsNeeded.length > 0 && (
            <div className="space-y-2 mb-3">
              <p className="text-xs font-bold text-amber-400">Révisions recommandées :</p>
              {remediationsNeeded.map((remediationChapId) => (
                <button
                  key={remediationChapId}
                  onClick={() => onNavigateToChap?.(remediationChapId)}
                  className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-amber-600/20 text-amber-300 hover:bg-amber-600/30 border border-amber-600/30 w-full text-left"
                  aria-label={`Réviser le chapitre ${remediationChapId}`}
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Réviser : {remediationChapId}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <button onClick={() => setDismissed(true)} className="text-xs px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600" aria-label="Continuer vers le cours">Continuer vers le cours</button>
    </div>
  );
}
