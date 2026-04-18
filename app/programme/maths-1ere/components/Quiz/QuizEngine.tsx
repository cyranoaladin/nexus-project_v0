'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  Target, 
  CheckCircle2, 
  XCircle, 
  Clock3, 
  Trophy, 
  RefreshCw, 
  PenSquare, 
  ChevronRight,
  ChevronLeft,
  AlertTriangle
} from 'lucide-react';
import { useMathsLabStore } from '../../store';
import { quizData, type QuizQuestion } from '../../data';
import { MathRichText } from '../MathContent';

interface QuizEngineProps {
  onSwitchTab: (tab: 'dashboard' | 'cours' | 'entrainement' | 'formulaire') => void;
}

type QuizMode = 'theme' | 'exam';
type QuizPhase = 'idle' | 'question' | 'feedback' | 'result';

export const QuizEngine: React.FC<QuizEngineProps> = ({ onSwitchTab }) => {
  const [mode, setMode] = useState<QuizMode>('theme');
  const [phase, setPhase] = useState<QuizPhase>('idle');
  const [themeFilter, setThemeFilter] = useState<string>('all');
  const [questionCount, setQuestionCount] = useState<number>(6);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  
  const store = useMathsLabStore();

  const categoryList = Array.from(new Set(quizData.map((q) => q.categorie))).sort();
  const current = questions[index];
  const isExam = mode === 'exam';

  // Timer logic
  useEffect(() => {
    if (!timerActive || timeLeft <= 0) return;
    const id = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setTimerActive(false);
          handleFinishQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerActive, timeLeft]);

  const handleStartQuiz = useCallback(() => {
    let pool = [...quizData];
    if (!isExam && themeFilter !== 'all') {
      pool = pool.filter((q) => q.categorie === themeFilter);
    }
    const desiredCount = isExam ? 12 : questionCount;
    const drawn = [...pool]
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.min(desiredCount, pool.length));

    setQuestions(drawn);
    setIndex(0);
    setScore(0);
    setAnswers({});
    setPhase('question');
    
    if (isExam) {
      setTimeLeft(20 * 60); // 20 mins for exam
      setTimerActive(true);
    }
  }, [themeFilter, questionCount, isExam]);

  const handleAnswer = (optionIndex: number) => {
    if (answers[index] !== undefined) return;
    
    setAnswers({ ...answers, [index]: optionIndex });
    
    if (optionIndex === current.correct) {
      setScore(s => s + 1);
      store.incrementCombo();
    } else {
      store.resetCombo();
    }

    if (!isExam) {
      setPhase('feedback');
    } else if (index < questions.length - 1) {
      setIndex(index + 1);
    } else {
      handleFinishQuiz();
    }
  };

  const handleFinishQuiz = useCallback(() => {
    setTimerActive(false);
    const xpGain = isExam ? score * 15 : score * 10;
    store.addQuizScore(xpGain);
    setPhase('result');
  }, [score, isExam, store]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  if (phase === 'idle') {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-slate-800/40 border border-slate-700/30 rounded-3xl p-8 mb-6">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-cyan-500/20 rounded-2xl">
              <PenSquare className="h-6 w-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Entraînement & Automatismes</h2>
              <p className="text-slate-400 text-sm">Préparez-vous efficacement pour les épreuves de Première.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <button 
              onClick={() => setMode('theme')}
              className={`p-6 rounded-2xl border transition-all text-left ${
                mode === 'theme' 
                ? 'bg-cyan-500/10 border-cyan-500/50 ring-1 ring-cyan-500/50' 
                : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
              }`}
            >
              <h3 className="font-bold text-white mb-1">Mode Thématique</h3>
              <p className="text-xs text-slate-500">Cibler un chapitre précis pour progresser par étape.</p>
            </button>
            <button 
              onClick={() => setMode('exam')}
              className={`p-6 rounded-2xl border transition-all text-left ${
                mode === 'exam' 
                ? 'bg-purple-500/10 border-purple-500/50 ring-1 ring-purple-500/50' 
                : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
              }`}
            >
              <h3 className="font-bold text-white mb-1">Mode Examen (EAM)</h3>
              <p className="text-xs text-slate-500">12 questions aléatoires en 20 minutes. Gain d&apos;XP boosté.</p>
            </button>
          </div>

          {mode === 'theme' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Choisir un thème</label>
                <select 
                  value={themeFilter} 
                  onChange={(e) => setThemeFilter(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500 transition-colors"
                >
                  <option value="all">Tous les thèmes</option>
                  {categoryList.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Nombre de questions : {questionCount}</label>
                <input 
                  type="range" min="3" max="20" value={questionCount} 
                  onChange={(e) => setQuestionCount(parseInt(e.target.value))} 
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" 
                />
              </div>
            </div>
          )}

          <button 
            onClick={handleStartQuiz}
            className="w-full mt-8 bg-cyan-600 text-white font-bold py-4 rounded-2xl hover:bg-cyan-500 transition-all shadow-lg shadow-cyan-600/20 active:scale-[0.98]"
          >
            Démarrer la session
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'question' || phase === 'feedback') {
    const isAnswered = answers[index] !== undefined;
    const progress = ((index + 1) / questions.length) * 100;

    return (
      <div className="max-w-3xl mx-auto">
        {/* Progress & Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4 text-xs font-bold uppercase tracking-widest text-slate-500">
            <span>Question {index + 1} / {questions.length}</span>
            {isExam && (
              <span className={`flex items-center gap-2 ${timeLeft < 60 ? 'text-red-400 animate-pulse' : 'text-cyan-400'}`}>
                <Clock3 className="h-4 w-4" />
                {formatTimer(timeLeft)}
              </span>
            )}
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-cyan-500 transition-all duration-500" 
              style={{ width: `${progress}%` }} 
            />
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-slate-800/40 border border-slate-700/30 rounded-3xl p-8 mb-6 shadow-xl">
          <div className="text-xl md:text-2xl text-white font-medium mb-10 leading-relaxed">
            <MathRichText content={current.question} />
          </div>

          <div className="grid grid-cols-1 gap-3">
            {current.options.map((opt, i) => {
              let cls = "bg-slate-900/50 border-slate-700 hover:border-cyan-500/50";
              const isSelected = answers[index] === i;
              const isCorrect = i === current.correct;

              if (phase === 'feedback' || (isExam && isAnswered)) {
                if (isCorrect) cls = "bg-green-500/10 border-green-500/50 text-green-400";
                else if (isSelected) cls = "bg-red-500/10 border-red-500/50 text-red-400 opacity-60";
                else cls = "bg-slate-900/50 border-slate-700 opacity-40";
              } else if (isSelected) {
                cls = "bg-cyan-500/10 border-cyan-500/50 text-cyan-400";
              }

              return (
                <button
                  key={i}
                  disabled={isAnswered}
                  onClick={() => handleAnswer(i)}
                  className={`w-full text-left p-4 md:p-5 rounded-2xl border transition-all flex items-center gap-4 group ${cls}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs border transition-colors ${
                    isSelected ? 'bg-current text-slate-900 border-transparent' : 'bg-slate-800 border-slate-700 group-hover:border-cyan-500/50'
                  }`}>
                    {String.fromCharCode(65 + i)}
                  </div>
                  <div className="flex-1 font-mono text-sm md:text-base">
                    <MathRichText content={opt} />
                  </div>
                  {isAnswered && isCorrect && <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />}
                  {isAnswered && isSelected && !isCorrect && <XCircle className="h-5 w-5 text-red-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Feedback Area */}
        <AnimatePresence>
          {phase === 'feedback' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-800/40 border border-slate-700/30 rounded-3xl p-6"
            >
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-xl ${answers[index] === current.correct ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {answers[index] === current.correct ? <Target className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                </div>
                <div className="flex-1">
                  <p className={`font-bold mb-2 ${answers[index] === current.correct ? 'text-green-400' : 'text-red-400'}`}>
                    {answers[index] === current.correct ? 'Excellent !' : 'Pas tout à fait...'}
                  </p>
                  <div className="text-slate-300 text-sm leading-relaxed mb-6">
                    <MathRichText content={current.explication} />
                  </div>
                  <button 
                    onClick={() => {
                      if (index < questions.length - 1) {
                        setIndex(index + 1);
                        setPhase('question');
                      } else {
                        handleFinishQuiz();
                      }
                    }}
                    className="w-full bg-slate-700 text-white font-bold py-3 rounded-xl hover:bg-slate-600 transition-all flex items-center justify-center gap-2"
                  >
                    Question suivante
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (phase === 'result') {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="max-w-2xl mx-auto text-center">
        <div className="bg-slate-800/40 border border-slate-700/30 rounded-3xl p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-cyan-500 to-blue-600" />
          
          <div className="mb-8">
            <div className="w-24 h-24 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trophy className="h-12 w-12 text-cyan-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Session terminée !</h2>
            <p className="text-slate-400">Voici ton bilan de performance.</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-10">
            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-700/30">
              <div className="text-4xl font-bold text-white mb-1">{score} / {questions.length}</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Score Correct</div>
            </div>
            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-700/30">
              <div className="text-4xl font-bold text-cyan-400 mb-1">+{isExam ? score * 15 : score * 10}</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">XP Gagnés</div>
            </div>
          </div>

          <div className="space-y-4">
            <button 
              onClick={() => {
                setPhase('idle');
                setAnswers({});
              }}
              className="w-full bg-cyan-600 text-white font-bold py-4 rounded-2xl hover:bg-cyan-500 transition-all shadow-lg shadow-cyan-600/10 flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-5 w-5" />
              Recommencer une session
            </button>
            <button 
              onClick={() => onSwitchTab('dashboard')}
              className="w-full bg-slate-700 text-slate-200 font-bold py-4 rounded-2xl hover:bg-slate-600 transition-all flex items-center justify-center gap-2"
            >
              Retour au tableau de bord
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
