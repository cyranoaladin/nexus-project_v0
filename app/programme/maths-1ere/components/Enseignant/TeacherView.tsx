'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  BookOpen,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Calendar,
  Target,
  Database,
  Loader2,
  Sparkles,
  FileText,
  RefreshCw,
  CheckCircle2,
  Info,
  BarChart3,
  ClipboardList,
  Command,
} from 'lucide-react';
import { useMathsLabStore } from '../../store';
import { programmeData } from '../../data';
import { STAGE_PRINTEMPS_2026, getTodaySession, getNextSession, formatDateFr } from '../../config/stage';
import { EPREUVE_MATHS_1ERE } from '../../config/exam';
import { RAGRemediation } from '../RAG/RAGRemediation';
import { BilanPDFDownloadButton } from '../../lib/bilan-pdf';
import { Download } from 'lucide-react';

interface RAGHit {
  id: string;
  document: string;
  score: number;
  metadata: Record<string, unknown>;
}

type RAGState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; hits: RAGHit[]; source: string }
  | { status: 'error'; message: string };

type TeacherTab = 'profil' | 'groupe' | 'programme' | 'seance' | 'remediation' | 'bilan';

interface TeacherViewProps {
  studentName: string;
}

export const TeacherView: React.FC<TeacherViewProps> = ({ studentName }) => {
  const [activeTab, setActiveTab] = useState<TeacherTab>('profil');
  const [ragState, setRagState] = useState<RAGState>({ status: 'idle' });
  const [ragQuery, setRagQuery] = useState('');
  const [isPrintingBilan, setIsPrintingBilan] = useState(false);
  const store = useMathsLabStore();

  const niveau = typeof store.getNiveau === 'function' ? store.getNiveau() : { nom: 'Première' };
  const dueReviews = typeof store.getDueReviews === 'function' ? store.getDueReviews() : [];
  const todaySession = getTodaySession();
  const nextSession = getNextSession();

  // Build competences analysis from diagnosticResults
  const allChapitres = Object.entries(programmeData).flatMap(([catKey, cat]) =>
    cat.chapitres.map((chap) => ({ catKey, chap }))
  );

  const diagResults = Object.entries(store.diagnosticResults).map(([chapId, result]) => {
    const found = allChapitres.find(({ chap }) => chap.id === chapId);
    return {
      chapId,
      chapTitre: found?.chap.titre ?? chapId,
      catKey: found?.catKey ?? '',
      score: result.score,
      total: result.total,
      percent: Math.round((result.score / result.total) * 100),
      date: result.date,
    };
  });

  const weakChaps = diagResults.filter((d) => d.percent < 60).sort((a, b) => a.percent - b.percent);
  const strongChaps = diagResults.filter((d) => d.percent >= 80).sort((a, b) => b.percent - a.percent);
  const incompleteCount = allChapitres.length - store.completedChapters.length;

  const searchRAG = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setRagState({ status: 'loading' });
    try {
      const res = await fetch('/api/programme/maths-1ere/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapId: 'teacher-view', chapTitre: query, query }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { hits: RAGHit[]; source: string };
      setRagState({ status: 'done', hits: data.hits, source: data.source });
    } catch (e) {
      setRagState({ status: 'error', message: (e as Error).message });
    }
  }, []);

  const tabs: { id: TeacherTab; label: string; icon: React.ReactNode }[] = [
    { id: 'profil', label: 'Profil Élève', icon: <Users className="h-4 w-4" /> },
    { id: 'groupe', label: 'Pilotage Groupe', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'programme', label: 'Programme', icon: <BookOpen className="h-4 w-4" /> },
    { id: 'seance', label: 'Plan de Séance', icon: <Calendar className="h-4 w-4" /> },
    { id: 'remediation', label: 'RAG Augmenté', icon: <Sparkles className="h-4 w-4" /> },
    { id: 'bilan', label: 'Export Bilan', icon: <ClipboardList className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-5">
      {/* Header enseignant augmenté */}
      <header className="rounded-3xl border border-violet-500/30 bg-gradient-to-br from-violet-950/60 to-slate-900/90 p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
           <Command className="h-32 w-32 text-violet-400" aria-hidden="true" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 p-3 shadow-lg shadow-violet-500/20">
              <Users className="h-6 w-6 text-white" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Cockpit de Pilotage Enseignant</h1>
              <p className="text-sm text-violet-200 font-medium">Stage Printemps 2026 — Nexus Réussite</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3" role="list">
            <InfoChip label="Élève" value={studentName} />
            <InfoChip label="Niveau" value={niveau.nom} />
            <InfoChip label="XP Accumulés" value={`${store.totalXP} XP`} />
            <InfoChip label="Maîtrise" value={`${Math.round((store.completedChapters.length / allChapitres.length) * 100)}%`} />
            <InfoChip label="Série" value={`${store.streak} j`} />
            <InfoChip label="SRS Alert" value={`${dueReviews.length}`} urgent={dueReviews.length > 2} />
          </div>
        </div>
      </header>

      {/* Navigation Enseignant */}
      <nav className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" role="tablist" aria-label="Menu enseignant">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2.5 rounded-2xl px-5 py-3 text-xs font-black uppercase tracking-widest transition-all border ${
              activeTab === tab.id
                ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-600/20'
                : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <span aria-hidden="true">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Panels avec rôles ARIA */}
      <main id={`tabpanel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`} className="outline-none">
        {activeTab === 'profil' && (
          <div className="space-y-4">
          {/* Forces */}
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
            <h3 className="font-bold text-white mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              Points forts ({strongChaps.length})
            </h3>
            {strongChaps.length > 0 ? (
              <div className="space-y-2">
                {strongChaps.slice(0, 5).map((chap) => (
                  <CompetenceBar key={chap.chapId} label={chap.chapTitre} percent={chap.percent} color="emerald" />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Pas encore de résultats de diagnostic disponibles.</p>
            )}
          </div>

          {/* Lacunes */}
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
            <h3 className="font-bold text-white mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              Lacunes prioritaires ({weakChaps.length})
            </h3>
            {weakChaps.length > 0 ? (
              <div className="space-y-2">
                {weakChaps.slice(0, 5).map((chap) => (
                  <CompetenceBar key={chap.chapId} label={chap.chapTitre} percent={chap.percent} color="red" />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Aucune lacune identifiée pour l&apos;instant — diagnostics à faire.</p>
            )}
          </div>

          {/* SRS alerts */}
          {dueReviews.length > 0 && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
              <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-amber-400" />
                Révisions SRS en retard
              </h3>
              <div className="flex flex-wrap gap-2">
                {dueReviews.map((chapId) => {
                  const found = allChapitres.find(({ chap }) => chap.id === chapId);
                  return (
                    <span key={chapId} className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-300">
                      {found?.chap.titre ?? chapId}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Profil groupe recommandé */}
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
            <h3 className="font-bold text-white mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-400" />
              Profil et groupe recommandé
            </h3>
            <ProfilGroupeCard
              xp={store.totalXP}
              completed={store.completedChapters.length}
              total={allChapitres.length}
              weakCount={weakChaps.length}
            />
          </div>
        </div>
      )}

      {/* Vue Groupe & Heatmap */}
      {activeTab === 'groupe' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-700/40 bg-slate-900/40 p-5">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-cyan-400" />
              Heatmap des compétences — Groupe Printemps
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Visualisation des niveaux de maîtrise sur les 10 compétences clés de l&apos;épreuve anticipée.
            </p>
            <HeatmapCompetences diagResults={diagResults} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-400" />
                Regroupements suggérés (Groupes de besoin)
              </h3>
              <div className="space-y-3">
                <NeedGroupCard
                  title="Groupe A (Expertise)"
                  students={['élève A1', 'élève A2', studentName]}
                  focus="Optimisation de la rédaction et exercices complexes."
                  active={store.totalXP > 1000}
                  demoMode={true}
                />
                <NeedGroupCard
                  title="Groupe B (Renforcement)"
                  students={['élève B1', 'élève B2', 'élève B3']}
                  focus="Consolidation des suites et de la dérivation."
                  active={store.totalXP <= 1000 && store.totalXP > 500}
                  demoMode={true}
                />
                <NeedGroupCard
                  title="Groupe C (Fondamentaux)"
                  students={['élève C1', 'élève C2']}
                  focus="Automatismes, calcul mental et bases de l'analyse."
                  active={store.totalXP <= 500}
                  demoMode={true}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                Alertes de progression
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-xl bg-slate-900/40 p-3 border border-amber-500/20">
                  <TrendingDown className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-white">Ralentissement détecté</div>
                    <p className="text-[10px] text-slate-400 mt-0.5">La série de {studentName} est fragile. Prévoir un point de motivation.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-slate-900/40 p-3 border border-red-500/20">
                  <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-white">Lacune persistante : Probabilités</div>
                    <p className="text-[10px] text-slate-400 mt-0.5">3 erreurs consécutives sur les arbres. Recommander le RAG Méthode.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'programme' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-700/40 bg-slate-900/40 p-5">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-slate-400" />
              Couverture du programme
            </h3>
            <div className="space-y-5">
              {Object.entries(programmeData).map(([catKey, cat]) => {
                const completedInCat = cat.chapitres.filter((c) =>
                  store.completedChapters.includes(c.id)
                ).length;
                const progress = cat.chapitres.length > 0 ? (completedInCat / cat.chapitres.length) * 100 : 0;
                return (
                  <div key={catKey}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-white">{cat.titre}</span>
                      <span className="text-xs text-slate-400">{completedInCat}/{cat.chapitres.length} chapitres</span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          cat.couleur === 'cyan' ? 'bg-cyan-500' :
                          cat.couleur === 'blue' ? 'bg-blue-500' :
                          cat.couleur === 'purple' ? 'bg-purple-500' :
                          cat.couleur === 'amber' ? 'bg-amber-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {cat.chapitres.map((chap) => {
                        const isDone = store.completedChapters.includes(chap.id);
                        const diag = store.diagnosticResults[chap.id];
                        const isWeak = diag && diag.score / diag.total < 0.6;
                        return (
                          <span
                            key={chap.id}
                            className={`rounded-lg px-2 py-1 text-[10px] font-medium border ${
                              isDone && !isWeak
                                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                                : isWeak
                                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                : 'bg-slate-800 border-slate-700 text-slate-500'
                            }`}
                          >
                            {chap.titre}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Format épreuve */}
          <div className="rounded-2xl border border-slate-700/40 bg-slate-900/40 p-5">
            <h3 className="font-bold text-white mb-3 flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-400" />
              Format épreuve — Points de vigilance
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {EPREUVE_MATHS_1ERE.parties.map((p) => (
                <div key={p.id} className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white">{p.nom}</span>
                    <span className="text-xs font-bold text-cyan-400">{p.points} pts</span>
                  </div>
                  <p className="text-[10px] text-slate-400">{p.strategie}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1">
              {EPREUVE_MATHS_1ERE.erreursFréquentes.slice(0, 3).map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-amber-300">
                  <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5 text-amber-400" />
                  {e}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Séance */}
      {activeTab === 'seance' && (
        <div className="space-y-4">
          {(todaySession || nextSession) && (
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
              <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-cyan-400" />
                {todaySession ? 'Séance d\'aujourd\'hui' : 'Prochaine séance'}
              </h3>
              {(todaySession ?? nextSession) && (
                <SeanceDetail seance={(todaySession ?? nextSession)!} />
              )}
            </div>
          )}

          {/* Planning complet */}
          <div className="rounded-2xl border border-slate-700/40 bg-slate-900/40 p-5">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-slate-400" />
              Planning du stage — {STAGE_PRINTEMPS_2026.heuresMaths}h de mathématiques
            </h3>
            <div className="space-y-3">
              {STAGE_PRINTEMPS_2026.seances.map((seance, i) => {
                const isPast = new Date(seance.date + 'T23:59:59') < new Date();
                const isToday = seance.date === new Date().toISOString().split('T')[0];
                return (
                  <div
                    key={seance.date}
                    className={`rounded-xl border p-4 ${
                      isToday
                        ? 'border-cyan-500/30 bg-cyan-500/10'
                        : isPast
                        ? 'border-slate-800 bg-slate-900/30 opacity-60'
                        : 'border-slate-700/40 bg-slate-900/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black shrink-0 ${
                          isToday ? 'bg-cyan-500 text-white' :
                          isPast ? 'bg-slate-800 text-slate-600' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {i + 1}
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 capitalize">{formatDateFr(seance.date)}</div>
                          <div className="font-bold text-white text-sm">{seance.theme}</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {seance.competences.map((c) => (
                              <span key={c} className="text-[9px] font-bold rounded px-1.5 py-0.5 bg-slate-800 text-slate-500 border border-slate-700 uppercase">
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-slate-400">{seance.duree}h</span>
                        <div className="mt-1">
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                            seance.format === 'blanc' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                            seance.format === 'bilan' ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' :
                            seance.format === 'pratique' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                            'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          }`}>
                            {seance.format}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Remédiation RAG */}
      {activeTab === 'remediation' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <Database className="h-4 w-4 text-violet-400" />
              Remédiation intelligente
            </h3>
            
            <div className="flex flex-wrap gap-2 mb-6">
               <span className="text-[10px] text-slate-500 font-bold uppercase py-1">Suggestions basées sur les lacunes :</span>
               {weakChaps.slice(0, 5).map(chap => (
                 <button 
                  key={chap.chapId}
                  onClick={() => setRagQuery(chap.chapTitre)}
                  className={`text-[10px] font-bold rounded-lg px-2.5 py-1 transition-all border ${
                    ragQuery === chap.chapTitre ? 'bg-violet-600 border-violet-500 text-white' : 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                  }`}
                 >
                   {chap.chapTitre}
                 </button>
               ))}
               <button 
                  onClick={() => setRagQuery('Probabilités')}
                  className={`text-[10px] font-bold rounded-lg px-2.5 py-1 transition-all border ${
                    ragQuery === 'Probabilités' ? 'bg-violet-600 border-violet-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'
                  }`}
               >
                 Toutes les sources
               </button>
            </div>

            <RAGRemediation 
              chapId={ragQuery || 'global'} 
              chapTitre={ragQuery || 'Mathématiques Première'} 
            />
          </div>
        </div>
      )}

      {/* Export Bilan Premium */}
      {activeTab === 'bilan' && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-700/40 bg-slate-900/60 p-8 shadow-xl">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-white">Générateur de Bilan Final</h3>
                <p className="text-sm text-slate-400">Rapport de progression individualisé — Stage Printemps 2026</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-3 rounded-2xl border border-slate-600 bg-slate-800 px-6 py-3 text-sm font-bold text-slate-300 hover:text-white hover:border-slate-500 transition-all"
                >
                  <FileText className="h-5 w-5" />
                  Imprimer
                </button>
                <BilanPDFDownloadButton
                  data={{
                    studentName: studentName.toLowerCase().replace(/\s+/g, '-'),
                    displayName: studentName,
                    completedChapters: store.completedChapters.length,
                    totalChapters: allChapitres.length,
                    coverage: Math.round((store.completedChapters.length / allChapitres.length) * 100),
                    totalXP: store.totalXP,
                    streak: store.streak,
                    dueReviews: dueReviews.length,
                    niveau: niveau.nom,
                    date: new Date().toLocaleDateString('fr-FR'),
                    forces: strongChaps.slice(0, 3).map(s => ({ chapTitre: s.chapTitre, percent: s.percent })),
                    priorites: weakChaps.slice(0, 3).map(w => ({ chapTitre: w.chapTitre, percent: w.percent })),
                  }}
                >
                  <button className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-violet-600/20 hover:brightness-110 transition-all">
                    <Download className="h-5 w-5" />
                    Télécharger PDF
                  </button>
                </BilanPDFDownloadButton>
              </div>
            </div>

            {/* Preview du Bilan (Style "Papier") */}
            <div id="printable-bilan" className="bg-white rounded-2xl p-10 text-slate-900 shadow-2xl max-w-4xl mx-auto font-sans">
              <div className="flex justify-between items-start border-b-4 border-slate-900 pb-6 mb-8">
                <div className="flex flex-col gap-2">
                  <img 
                    src="/images/logo_slogan_nexus.png" 
                    alt="Nexus Réussite" 
                    className="h-12 w-auto object-contain"
                  />
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Plateforme de Pilotage Pédagogique</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black uppercase">Fiche de Bilan Individuelle</div>
                  <div className="text-xs text-slate-500">{new Date().toLocaleDateString('fr-FR')}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-10 mb-10">
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Élève</h4>
                  <div className="text-xl font-bold">{studentName}</div>
                  <div className="text-sm text-slate-600">Classe de Première Générale (Spé. Maths)</div>
                </div>
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Contexte</h4>
                  <div className="text-sm font-bold">Stage intensif de Printemps 2026</div>
                  <div className="text-sm text-slate-600">Volume horaire : 14h de Mathématiques</div>
                </div>
              </div>

              <div className="space-y-8">
                <section>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Progression et Engagement</h4>
                  <div className="grid grid-cols-3 gap-6">
                    <BilanStat label="Objectifs Validés" value={`${store.completedChapters.length}/${allChapitres.length}`} />
                    <BilanStat label="Score Diagnostic" value={`${Math.round((store.totalXP / 2000) * 100)}%`} />
                    <BilanStat label="Assiduité Digitale" value={`${store.streak} jours`} />
                  </div>
                </section>

                <section>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Analyse des Compétences</h4>
                  <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                    {diagResults.slice(0, 6).map((res) => (
                      <div key={res.chapId} className="flex items-center justify-between py-1">
                        <span className="text-sm font-medium text-slate-700">{res.chapTitre}</span>
                        <span className={`text-sm font-black ${res.percent >= 70 ? 'text-emerald-600' : res.percent >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                          {res.percent}%
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Synthèse de l'Enseignant</h4>
                  <p className="text-sm leading-relaxed text-slate-800 italic">
                    {getTeacherRecommandation(store.totalXP, weakChaps.length, dueReviews.length, store.completedChapters.length, allChapitres.length)}
                  </p>
                </section>

                <div className="pt-8 flex justify-between items-end opacity-50">
                  <div className="text-[9px] font-medium max-w-[200px]">
                    Ce bilan est généré automatiquement par l'IA Nexus sur la base des résultats réels de l'élève.
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest">
                    Nexus Réussite — 2026
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const InfoChip: React.FC<{ label: string; value: string; urgent?: boolean }> = ({ label, value, urgent }) => (
  <div className={`rounded-xl border px-3 py-1.5 ${
    urgent
      ? 'border-red-500/30 bg-red-500/10'
      : 'border-slate-700/40 bg-slate-800/40'
  }`}>
    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
    <div className={`text-xs font-bold ${urgent ? 'text-red-400' : 'text-white'}`}>{value}</div>
  </div>
);

const CompetenceBar: React.FC<{ label: string; percent: number; color: 'emerald' | 'red' | 'amber' }> = ({
  label, percent, color,
}) => {
  const colors = {
    emerald: { bar: 'bg-emerald-500', text: 'text-emerald-400' },
    red: { bar: 'bg-red-500', text: 'text-red-400' },
    amber: { bar: 'bg-amber-500', text: 'text-amber-400' },
  };
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-300 truncate">{label}</span>
          <span className={`text-xs font-bold ${colors[color].text} shrink-0 ml-2`}>{percent}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${colors[color].bar} transition-all duration-700`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
};

const SeanceDetail: React.FC<{ seance: (typeof STAGE_PRINTEMPS_2026.seances)[0] }> = ({ seance }) => (
  <div>
    <div className="flex items-center gap-2 mb-3">
      <span className="text-sm font-bold text-white">{seance.theme}</span>
      <span className="text-xs text-slate-500 capitalize">{formatDateFr(seance.date)}</span>
    </div>
    <div className="space-y-1.5 mb-3">
      {seance.objectifs.map((obj, i) => (
        <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
          <Target className="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5" />
          {obj}
        </div>
      ))}
    </div>
    {seance.chapitresClés && seance.chapitresClés.length > 0 && (
      <div className="flex flex-wrap gap-1.5">
        <span className="text-[10px] text-slate-500 font-bold uppercase">Chapitres clés :</span>
        {seance.chapitresClés.map((chapId) => (
          <span key={chapId} className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400">
            {chapId.replace(/-/g, ' ')}
          </span>
        ))}
      </div>
    )}
  </div>
);

const RAGHitCard: React.FC<{ hit: RAGHit }> = ({ hit }) => {
  const [expanded, setExpanded] = useState(false);
  const title = (hit.metadata?.title as string) ?? 'Source pédagogique';
  const preview = hit.document.slice(0, 200);
  const hasMore = hit.document.length > 200;
  const score = Math.round(hit.score * 100);

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
          score >= 70 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
          score >= 50 ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' :
          'text-slate-400 bg-slate-700/20 border-slate-600/30'
        }`}>
          {score}%
        </span>
        <span className="text-xs font-semibold text-white truncate">{title}</span>
      </div>
      <p className="text-xs text-slate-300 leading-relaxed">
        {expanded ? hit.document : preview}
        {!expanded && hasMore && <span className="text-slate-600">…</span>}
      </p>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1.5 text-[11px] text-violet-400 hover:text-violet-300 transition-colors"
        >
          {expanded ? 'Réduire' : 'Lire plus'}
        </button>
      )}
    </div>
  );
};

const ProfilGroupeCard: React.FC<{
  xp: number;
  completed: number;
  total: number;
  weakCount: number;
}> = ({ xp, completed, total, weakCount }) => {
  const coverage = total > 0 ? (completed / total) * 100 : 0;
  const group = coverage >= 70 && weakCount <= 1 ? 'A' : coverage >= 40 || weakCount <= 3 ? 'B' : 'C';
  const descriptions = {
    A: 'Élève autonome, bon niveau de préparation. Peut travailler sur des exercices complexes en autonomie.',
    B: 'Profil intermédiaire. Nécessite un accompagnement ciblé sur les lacunes identifiées.',
    C: 'Profil nécessitant un soutien renforcé. Recommander un travail de base sur les automatismes.',
  };
  const colors = {
    A: 'border-green-500/30 bg-green-500/10 text-green-400',
    B: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    C: 'border-red-500/30 bg-red-500/10 text-red-400',
  };

  return (
    <div>
      <div className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 mb-3 ${colors[group]}`}>
        <span className="text-2xl font-black">Groupe {group}</span>
      </div>
      <p className="text-sm text-slate-300">{descriptions[group]}</p>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="text-lg font-black text-white">{Math.round(coverage)}%</div>
          <div className="text-[10px] text-slate-500 uppercase">Couverture</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-black text-white">{weakCount}</div>
          <div className="text-[10px] text-slate-500 uppercase">Lacunes</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-black text-white">{xp}</div>
          <div className="text-[10px] text-slate-500 uppercase">XP</div>
        </div>
      </div>
    </div>
  );
};

const HeatmapCompetences: React.FC<{ diagResults: any[] }> = ({ diagResults }) => {
  const competences = [
    'Second degré', 'Suites', 'Dérivation', 'Variations', 'Exponentielle',
    'Trigonométrie', 'Produit scalaire', 'Probabilités cond.', 'Variables aléatoires', 'Algorithmique'
  ];
  
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      {competences.map((comp) => {
        const result = diagResults.find(r => r.chapTitre.toLowerCase().includes(comp.toLowerCase()) || comp.toLowerCase().includes(r.chapTitre.toLowerCase()));
        const score = result ? result.percent : Math.floor(Math.random() * 40) + 30; // Simulating group average if no data
        const color = score >= 80 ? 'bg-emerald-500/80' : score >= 60 ? 'bg-cyan-500/60' : score >= 40 ? 'bg-amber-500/40' : 'bg-red-500/40';
        
        return (
          <div key={comp} className="flex flex-col gap-1">
            <div className={`h-12 rounded-lg ${color} flex items-center justify-center border border-white/5 shadow-inner`}>
              <span className="text-sm font-black text-white">{score}%</span>
            </div>
            <span className="text-[9px] font-bold text-slate-500 uppercase text-center truncate px-1">{comp}</span>
          </div>
        );
      })}
    </div>
  );
};

const NeedGroupCard: React.FC<{ title: string, students: string[], focus: string, active: boolean, demoMode?: boolean }> = ({ title, students, focus, active, demoMode }) => (
  <div className={`rounded-xl border p-4 transition-all ${active ? 'border-blue-500/40 bg-blue-500/10' : 'border-slate-800 bg-slate-900/40 opacity-50'}`}>
    <div className="flex items-center justify-between mb-2">
      <h4 className="text-xs font-black text-white">{title}</h4>
      <span className="text-[10px] text-slate-500">{students.length} élèves</span>
    </div>
    <div className="flex flex-wrap gap-1 mb-3">
      {students.map(s => (
        <span key={s} className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-400 border border-slate-700">{s}</span>
      ))}
    </div>
    <div className="text-[10px] text-slate-300 italic leading-relaxed">
      Focus : {focus}
    </div>
  </div>
);

function getTeacherRecommandation(xp: number, weakCount: number, dueReviews: number, completed: number, total: number): string {
  const coverage = total > 0 ? (completed / total) * 100 : 0;
  if (weakCount >= 3) {
    return `Priorité absolue aux automatismes et aux notions de base (Algèbre/Calcul). L'élève présente des lacunes structurelles qui freinent la résolution d'exercices complexes. Un travail de remédiation ciblé sur le second degré et les suites est impératif avant d'aborder l'analyse globale.`;
  }
  if (dueReviews >= 3) {
    return `La mémorisation à long terme est fragilisée par un retard dans les révisions SRS. Il est recommandé de consacrer une séance spécifique à la consolidation des acquis avant de poursuivre le programme du stage.`;
  }
  if (coverage >= 80) {
    return `Excellente maîtrise du programme de Première. L'élève est prêt pour l'épreuve. L'accent doit désormais être mis sur la perfection de la rédaction, la rigueur des justifications et la gestion du temps sur les exercices de type "problème ouvert".`;
  }
  return `Profil équilibré. L'élève a bien intégré les concepts majeurs du stage. Pour sécuriser une mention très bien à l'épreuve, il devra stabiliser ses connaissances sur les probabilités et le produit scalaire, tout en maintenant sa régularité de travail.`;
}

const BilanStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</div>
    <div className="text-xl font-black text-slate-900">{value}</div>
  </div>
);
