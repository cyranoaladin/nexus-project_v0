'use client';

import React, { useState } from 'react';
import { 
  Lightbulb, 
  Search, 
  BookOpen, 
  PenSquare, 
  CheckCircle2
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { type Chapitre, type Categorie } from '../../../data';
import { type HintLevel } from '../../../store';
import { MathInline, MathRichText } from '../../MathContent';
import DiagnosticPrerequis from '../../DiagnosticPrerequis';
import InteractiveGraph from '../../InteractiveGraph';
import ExerciseEngine from '../../ExerciseEngine';
import ProceduralExercise from '../../ProceduralExercise';

// Dynamic imports for labs
const ToileAraignee = dynamic(() => import('../../labs/ToileAraignee'), { ssr: false });
const ParabolaController = dynamic(() => import('../../labs/ParabolaController'), { ssr: false });
const TangenteGlissante = dynamic(() => import('../../labs/TangenteGlissante'), { ssr: false });
const NewtonSolver = dynamic(() => import('../../labs/NewtonSolver'), { ssr: false });
const Enrouleur = dynamic(() => import('../../labs/Enrouleur'), { ssr: false });
const ArchimedePi = dynamic(() => import('../../labs/ArchimedePi'), { ssr: false });
const VectorProjector = dynamic(() => import('../../labs/VectorProjector'), { ssr: false });
const MonteCarloSim = dynamic(() => import('../../labs/MonteCarloSim'), { ssr: false });
const PythonExercises = dynamic(() => import('../../labs/PythonExercises'), { ssr: false });
const PythonIDE = dynamic(() => import('../../PythonIDE'), { ssr: false });
const EulerExponentielle = dynamic(() => import('../../labs/EulerExponentielle'), { ssr: false });
const InteractiveMafs = dynamic(() => import('../../InteractiveMafs'), { ssr: false });

interface ChapterPracticeProps {
  catKey: string;
  cat: Categorie;
  chap: Chapitre;
  chapId: string;
  onRecordDiagnostic: (score: number, total: number) => void;
  onRecordExerciseResult: (chapId: string, score: number) => void;
  onRecordHintUsage: (level: HintLevel) => void;
}

export const ChapterPractice: React.FC<ChapterPracticeProps> = ({
  catKey,
  cat,
  chap,
  chapId,
  onRecordDiagnostic,
  onRecordExerciseResult,
  onRecordHintUsage
}) => {
  const [hintLevel, setHintLevel] = useState(0);
  const [showSolution, setShowSolution] = useState(false);

  const handleHintClick = (level: HintLevel) => {
    const newLevel = hintLevel === level ? level - 1 : level;
    setHintLevel(newLevel);
    if (newLevel >= level) {
      onRecordHintUsage(level);
    }
  };

  return (
    <div className="space-y-10">
      {/* Prerequis Diagnostic */}
      {chap.prerequisDiagnostic && (
        <div className="bg-slate-900/40 rounded-2xl p-6 border border-slate-700/30">
          <DiagnosticPrerequis
            chapId={chapId}
            questions={chap.prerequisDiagnostic}
            onComplete={onRecordDiagnostic}
          />
        </div>
      )}

      {/* Exercice d'application */}
      <section className="bg-slate-900 border border-slate-700 rounded-3xl p-8 shadow-inner">
        <div className="flex items-center gap-3 mb-6">
          <PenSquare className="h-6 w-6 text-cyan-400" />
          <h3 className="text-xl font-bold text-white">Exercice d&apos;application</h3>
        </div>
        
        <div className="text-slate-200 text-lg mb-8 leading-relaxed">
          <MathRichText content={chap.contenu.exercice.question} />
        </div>

        {/* Hint System */}
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <HintButton 
              active={hintLevel >= 1} 
              onClick={() => handleHintClick(1)}
              icon={<Lightbulb className="w-3.5 h-3.5" />}
              label="Indice"
              malus="-10% XP"
            />
            <HintButton 
              active={hintLevel >= 2} 
              onClick={() => handleHintClick(2)}
              icon={<Search className="w-3.5 h-3.5" />}
              label="Début"
              malus="-30% XP"
            />
            <HintButton 
              active={hintLevel >= 3} 
              onClick={() => handleHintClick(3)}
              icon={<BookOpen className="w-3.5 h-3.5" />}
              label="Correction"
              malus="-100% XP"
            />
          </div>

          {/* Hint Content */}
          <div className="space-y-3">
            {hintLevel >= 1 && chap.contenu.coupDePouce && (
              <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Indice</p>
                <div className="text-slate-300 text-sm"><MathRichText content={chap.contenu.coupDePouce.indice} /></div>
              </div>
            )}
            {hintLevel >= 2 && chap.contenu.coupDePouce && (
              <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Début de raisonnement</p>
                <div className="text-slate-300 text-sm"><MathRichText content={chap.contenu.coupDePouce.debutRaisonnement} /></div>
              </div>
            )}
            {hintLevel >= 3 && chap.contenu.coupDePouce && (
              <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                <p className="text-[10px] font-bold text-white uppercase tracking-widest mb-2">Correction complète</p>
                <ul className="space-y-2">
                  {chap.contenu.coupDePouce.correctionDetaillee.map((step, i) => (
                    <li key={i} className="text-slate-300 text-sm flex gap-2">
                      <span className="text-cyan-500 font-bold">•</span>
                      <MathRichText content={step} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {!chap.contenu.coupDePouce && (
              <div className="mt-4">
                <button 
                  onClick={() => setShowSolution(!showSolution)}
                  className="text-cyan-400 text-sm font-bold hover:text-cyan-300 transition-colors flex items-center gap-2"
                >
                  {showSolution ? 'Masquer' : 'Voir'} la solution complète
                </button>
                {showSolution && (
                  <div className="mt-6 pt-6 border-t border-slate-800 animate-in fade-in duration-500">
                    <div className="text-green-400 font-bold mb-4 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Réponse : <MathInline math={chap.contenu.exercice.reponse} />
                    </div>
                    <ul className="space-y-2">
                      {chap.contenu.exercice.etapes.map((step, i) => (
                        <li key={i} className="text-slate-300 text-sm flex gap-2">
                          <span className="text-slate-500">{i+1}.</span>
                          <MathRichText content={step} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Labs & Interactive Section */}
      {((chap.exercices && chap.exercices.length > 0) || chap.contenu.geogebraId) && (
        <section className="space-y-8">
          <h3 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-1.5 h-6 bg-cyan-500 rounded-full" />
            Pratique & Laboratoire
          </h3>
          
          {chap.contenu.geogebraId && (
            <div className="rounded-3xl overflow-hidden border border-slate-700/30">
              <InteractiveGraph 
                geogebraId={chap.contenu.geogebraId} 
                title={`${chap.titre} — Graphique interactif`} 
              />
            </div>
          )}

          {chap.exercices && chap.exercices.length > 0 && (
            <ExerciseEngine 
              exercices={chap.exercices} 
              chapId={chapId} 
              onExerciseCorrect={onRecordExerciseResult} 
            />
          )}
          
          <ProceduralExercise chapId={chapId} />
        </section>
      )}

      {/* Specific Labs */}
      <section className="space-y-6">
        {chapId === 'suites' && <ToileAraignee />}
        {chapId === 'second-degre' && <ParabolaController />}
        {(chapId === 'derivation' || chapId === 'variations-courbes') && (
          <TangenteGlissante
            fnExpr={chapId === 'derivation' ? 'x^3 - 3*x' : 'x^2'}
            title={chapId === 'derivation' ? 'La Tangente Glissante — f(x) = x³ − 3x' : 'Variations — f(x) = x²'}
          />
        )}
        {(chapId === 'variations-courbes' || chapId === 'algo-newton') && <NewtonSolver />}
        {chapId === 'trigonometrie' && (
          <>
            <Enrouleur />
            <ArchimedePi />
          </>
        )}
        {chapId === 'produit-scalaire' && <VectorProjector />}
        {(chapId === 'probabilites-cond' || chapId === 'variables-aleatoires') && <MonteCarloSim />}
        
        {catKey === 'algorithmique' && (
          <>
            <PythonExercises />
            <PythonIDE
              initialCode={`# ${chap.titre}\n# Écris ton code Python ici\n\n`}
              onSuccess={() => onRecordExerciseResult(chapId, 99)}
            />
          </>
        )}

        {catKey === 'analyse' && !['derivation', 'variations-courbes', 'exponentielle'].includes(chapId) && (
          <InteractiveMafs
            title={`${chap.titre} — Visualisation`}
            elements={[
              { type: 'function', fn: 'x^2', color: 'blue', label: 'f(x) = x²' },
              { type: 'function', fn: '2*x', color: 'red', label: "f'(x) = 2x" },
            ]}
          />
        )}
        {chapId === 'exponentielle' && <EulerExponentielle />}
      </section>
    </div>
  );
};

const HintButton = ({ active, onClick, icon, label, malus }: any) => (
  <button 
    onClick={onClick} 
    className={`inline-flex items-center gap-2 text-[10px] font-bold px-4 py-2 rounded-xl transition-all border ${
      active 
      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400 shadow-lg shadow-cyan-500/10' 
      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
    }`}
  >
    {icon}
    <span className="uppercase tracking-widest">{label}</span>
    <span className="opacity-40">{malus}</span>
  </button>
);
