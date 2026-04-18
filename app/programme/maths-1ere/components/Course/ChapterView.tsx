'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Wrench, 
  AlertTriangle, 
  Lightbulb, 
  GraduationCap, 
  Printer, 
  Maximize2, 
  PanelLeft, 
  Check, 
  Search,
  Puzzle,
  BarChart3,
  Brain,
  Calculator,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  PenSquare
} from 'lucide-react';
import { useMathsLabStore } from '../../store';
import { programmeData, type CompetenceBO } from '../../data';
import { MathInline, MathBlock, MathRichText } from '../MathContent';
import DiagnosticPrerequis from '../DiagnosticPrerequis';
import InteractiveGraph from '../InteractiveGraph';
import ExerciseEngine from '../ExerciseEngine';
import ProceduralExercise from '../ProceduralExercise';
import GrandOralSuggestions from '../GrandOralSuggestions';
import RAGSources from '../RAGSources';
import dynamic from 'next/dynamic';

// Dynamic imports for labs
const ToileAraignee = dynamic(() => import('../labs/ToileAraignee'), { ssr: false });
const ParabolaController = dynamic(() => import('../labs/ParabolaController'), { ssr: false });
const TangenteGlissante = dynamic(() => import('../labs/TangenteGlissante'), { ssr: false });
const NewtonSolver = dynamic(() => import('../labs/NewtonSolver'), { ssr: false });
const Enrouleur = dynamic(() => import('../labs/Enrouleur'), { ssr: false });
const ArchimedePi = dynamic(() => import('../labs/ArchimedePi'), { ssr: false });
const VectorProjector = dynamic(() => import('../labs/VectorProjector'), { ssr: false });
const MonteCarloSim = dynamic(() => import('../labs/MonteCarloSim'), { ssr: false });
const PythonExercises = dynamic(() => import('../labs/PythonExercises'), { ssr: false });
const PythonIDE = dynamic(() => import('../PythonIDE'), { ssr: false });
const EulerExponentielle = dynamic(() => import('../labs/EulerExponentielle'), { ssr: false });
const InteractiveMafs = dynamic(() => import('../InteractiveMafs'), { ssr: false });

interface ChapterViewProps {
  catKey: string;
  chapId: string;
  focusMode: boolean;
  onToggleFocus: () => void;
}

export const ChapterView: React.FC<ChapterViewProps> = ({ 
  catKey, 
  chapId, 
  focusMode, 
  onToggleFocus 
}) => {
  const [hintLevel, setHintLevel] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const timeRef = useRef<number>(Date.now());
  const store = useMathsLabStore();
  
  const cat = programmeData[catKey];
  const chap = cat?.chapitres.find((c) => c.id === chapId);
  const isCompleted = store.completedChapters.includes(chapId);

  useEffect(() => {
    setShowSolution(false);
    setHintLevel(0);
    timeRef.current = Date.now();
    
    return () => {
      const elapsed = Math.round((Date.now() - timeRef.current) / 1000);
      if (elapsed > 10) store.addChapterTime(chapId, elapsed);
    };
  }, [chapId]);

  if (!cat || !chap) return null;

  const handleToggleComplete = () => {
    store.toggleChapterComplete(chapId);
  };

  const handlePrint = () => {
    window.print();
    store.markPrintedFiche();
    store.earnBadge('imprimeur');
  };

  return (
    <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/30 rounded-3xl p-6 md:p-10 relative overflow-hidden transition-all duration-500">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 p-8 opacity-5 text-[200px] select-none pointer-events-none transform translate-x-1/4 -translate-y-1/4">
        {cat.icon}
      </div>

      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start mb-10 relative z-10 gap-6">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
              cat.couleur === 'cyan' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
              cat.couleur === 'blue' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
              cat.couleur === 'purple' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
              cat.couleur === 'amber' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
              'bg-green-500/10 text-green-400 border-green-500/20'
            }`}>
              {cat.titre}
            </span>
            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-slate-700/50 text-slate-300 uppercase tracking-widest border border-slate-600/30">
              Difficulté {chap.difficulte}/5
            </span>
            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-400 uppercase tracking-widest border border-cyan-500/30">
              {chap.pointsXP} XP
            </span>
          </div>
          
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight leading-tight">
            {chap.titre}
          </h2>

          {/* Competencies */}
          {chap.competences && chap.competences.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {chap.competences.map((c) => (
                <CompetenceBadge key={c} type={c} />
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <button
            onClick={handlePrint}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white transition-all border border-slate-600/30 print:hidden"
          >
            <Printer className="h-4 w-4" />
            Imprimer
          </button>
          <button 
            onClick={onToggleFocus} 
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white transition-all border border-slate-600/30"
          >
            {focusMode ? <PanelLeft className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {focusMode ? 'Normal' : 'Focus'}
          </button>
          <button 
            onClick={handleToggleComplete} 
            className={`flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all text-sm shadow-lg ${
              isCompleted 
              ? 'bg-green-500 text-white shadow-green-500/20' 
              : 'bg-cyan-600 text-white hover:bg-cyan-500 shadow-cyan-600/20'
            }`}
          >
            {isCompleted ? <Check className="h-4 w-4" /> : null}
            {isCompleted ? 'Maîtrisé' : 'Terminer'}
          </button>
        </div>
      </div>

      <div className="space-y-10 relative z-10">
        {/* Prerequis Diagnostic */}
        {chap.prerequisDiagnostic && (
          <div className="bg-slate-900/40 rounded-2xl p-6 border border-slate-700/30">
            <DiagnosticPrerequis
              chapId={chapId}
              questions={chap.prerequisDiagnostic}
              onComplete={(score, total) => store.recordDiagnostic(chapId, score, total)}
            />
          </div>
        )}

        {/* L'Essentiel */}
        <section className="bg-slate-900/30 border border-slate-700/30 rounded-3xl p-8 transition-colors hover:border-cyan-500/20">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-cyan-400" />
            </div>
            L&apos;essentiel du cours
          </h3>
          <div className="prose prose-invert max-w-none text-slate-300 leading-relaxed text-lg">
            <MathRichText content={chap.contenu.rappel} />
          </div>
        </section>

        {/* Méthode & Formules */}
        <section className="bg-blue-900/10 border border-blue-500/20 rounded-3xl p-8">
          <h3 className="text-xl font-bold text-blue-300 mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Wrench className="h-5 w-5 text-blue-400" />
            </div>
            Méthodes & Formules
          </h3>
          <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-700/50">
            <MathBlock math={chap.contenu.methode} />
          </div>
          
          {/* Formules Table */}
          {chap.contenu.tableau && chap.contenu.tableau.length > 0 && (
            <div className="mt-8 overflow-hidden rounded-2xl border border-slate-700/30 bg-slate-900/20">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-800/50 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-700/30">
                    <th className="px-6 py-4">Fonction</th>
                    <th className="px-6 py-4">Dérivée / Propriété</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {chap.contenu.tableau.map((row, i) => (
                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 text-white font-mono text-sm"><MathInline math={row.f} /></td>
                      <td className="px-6 py-4 text-cyan-400 font-mono text-sm"><MathInline math={row.derivee} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Cas Table */}
          {chap.contenu.cas && chap.contenu.cas.length > 0 && (
            <div className="mt-8 overflow-hidden rounded-2xl border border-slate-700/30 bg-slate-900/20">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-800/50 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-700/30">
                    <th className="px-6 py-4">Condition</th>
                    <th className="px-6 py-4">Conclusion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {chap.contenu.cas.map((row, i) => (
                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 text-white font-mono text-sm"><MathInline math={row.delta} /></td>
                      <td className="px-6 py-4 text-slate-300 text-sm"><MathRichText content={row.solution} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Erreurs Classiques & Astuces */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {chap.contenu.erreursClassiques && chap.contenu.erreursClassiques.length > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-3xl p-8">
              <h3 className="text-lg font-bold text-red-400 mb-6 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5" />
                Erreurs Classiques
              </h3>
              <ul className="space-y-4">
                {chap.contenu.erreursClassiques.map((err, i) => (
                  <li key={i} className="flex gap-3 text-slate-300 text-sm">
                    <span className="text-red-500 mt-1 font-bold">✕</span>
                    <MathRichText content={err} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-amber-500/5 border border-amber-500/20 rounded-3xl p-8">
            <h3 className="text-lg font-bold text-amber-400 mb-6 flex items-center gap-3">
              <Lightbulb className="h-5 w-5" />
              Astuce du prof
            </h3>
            <div className="prose prose-invert text-slate-300 text-sm italic">
              <MathRichText content={chap.contenu.astuce} />
            </div>
          </div>
        </div>

        {/* Methodologie Bac */}
        {chap.contenu.methodologieBac && (
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-8">
            <h3 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-3">
              <GraduationCap className="h-6 w-6" />
              Méthodologie Bac
            </h3>
            <div className="text-slate-300 text-sm leading-relaxed">
              <MathRichText content={chap.contenu.methodologieBac} />
            </div>
          </div>
        )}

        {/* Exercice d'application */}
        <section className="bg-slate-900 border border-slate-700 rounded-3xl p-8">
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
                onClick={() => {
                  const newLevel = hintLevel === 1 ? 0 : 1;
                  setHintLevel(newLevel);
                  if (newLevel > 0) store.recordExerciseWithHint(chapId, -1, 1, chap.pointsXP);
                }}
                icon={<Lightbulb className="w-3.5 h-3.5" />}
                label="Indice"
                malus="-10% XP"
              />
              <HintButton 
                active={hintLevel >= 2} 
                onClick={() => {
                  const newLevel = hintLevel === 2 ? 1 : 2;
                  setHintLevel(newLevel);
                  if (newLevel > 1) store.recordExerciseWithHint(chapId, -1, 2, chap.pointsXP);
                }}
                icon={<Search className="w-3.5 h-3.5" />}
                label="Début"
                malus="-30% XP"
              />
              <HintButton 
                active={hintLevel >= 3} 
                onClick={() => {
                  const newLevel = hintLevel === 3 ? 2 : 3;
                  setHintLevel(newLevel);
                  if (newLevel > 2) store.recordExerciseWithHint(chapId, -1, 3, chap.pointsXP);
                }}
                icon={<BookOpen className="w-3.5 h-3.5" />}
                label="Correction"
                malus="-100% XP"
              />
            </div>

            {/* Hint Content */}
            <div className="space-y-3">
              {hintLevel >= 1 && chap.contenu.coupDePouce && (
                <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl">
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Indice</p>
                  <div className="text-slate-300 text-sm"><MathRichText content={chap.contenu.coupDePouce.indice} /></div>
                </div>
              )}
              {hintLevel >= 2 && chap.contenu.coupDePouce && (
                <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Début de raisonnement</p>
                  <div className="text-slate-300 text-sm"><MathRichText content={chap.contenu.coupDePouce.debutRaisonnement} /></div>
                </div>
              )}
              {hintLevel >= 3 && chap.contenu.coupDePouce && (
                <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl">
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
                    <div className="mt-6 pt-6 border-t border-slate-800">
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
                onExerciseCorrect={store.recordExerciseResult} 
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
                onSuccess={() => store.recordExerciseResult(chapId, 99)}
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

        {/* SRS & RAG Footer */}
        <footer className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-12">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-bold text-white flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-cyan-400" />
                Révision espacée
              </h4>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                SRS Memory Engine
              </span>
            </div>
            <div className="flex gap-2">
              <SRSButton quality={2} label="Difficile" onClick={() => store.recordSRSReview(chapId, 2)} />
              <SRSButton quality={3} label="Moyen" onClick={() => store.recordSRSReview(chapId, 3)} />
              <SRSButton quality={5} label="Facile" onClick={() => store.recordSRSReview(chapId, 5)} />
            </div>
          </div>
          
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-3xl p-6">
            <RAGSources chapId={chapId} chapTitre={chap.titre} />
          </div>
        </footer>

        {/* External Resources */}
        {chap.ressourcesExt && chap.ressourcesExt.length > 0 && (
          <div className="pt-6 border-t border-slate-700/30">
            <h4 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-widest">Ressources recommandées</h4>
            <div className="flex flex-wrap gap-4">
              {chap.ressourcesExt.map((res, i) => (
                <a 
                  key={i} 
                  href={res.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  {res.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Sub-components ─────────────────────────────────────────────────────────

const CompetenceBadge = ({ type }: { type: CompetenceBO }) => {
  const config: Record<string, { label: string; icon: any; color: string }> = {
    chercher: { label: 'Chercher', icon: Search, color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    modeliser: { label: 'Modéliser', icon: Puzzle, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    representer: { label: 'Représenter', icon: BarChart3, color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
    raisonner: { label: 'Raisonner', icon: Brain, color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    calculer: { label: 'Calculer', icon: Calculator, color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
    communiquer: { label: 'Communiquer', icon: MessageSquare, color: 'bg-pink-500/10 text-pink-400 border-pink-500/20' },
  };
  const { label, icon: Icon, color } = config[type] || { label: type, icon: Sparkles, color: 'bg-slate-500/10 text-slate-400' };
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${color} uppercase tracking-wide`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
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

const SRSButton = ({ quality, label, onClick }: any) => (
  <button
    onClick={onClick}
    className={`flex-1 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all border ${
      quality === 2 ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' :
      quality === 3 ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20' :
      'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20'
    }`}
  >
    {label}
  </button>
);
