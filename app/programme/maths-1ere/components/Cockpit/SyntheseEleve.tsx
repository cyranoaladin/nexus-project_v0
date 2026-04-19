'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Star, AlertTriangle, RefreshCw, BookOpen, Target } from 'lucide-react';
import { useMathsLabStore } from '../../store';
import { programmeData } from '../../data';

export const SyntheseEleve: React.FC<{ onNavigateToChap: (catKey: string, chapId: string) => void }> = ({
  onNavigateToChap,
}) => {
  const store = useMathsLabStore();

  const allChapitres = Object.entries(programmeData).flatMap(([catKey, cat]) =>
    cat.chapitres.map((chap) => ({ catKey, chap }))
  );

  // Top 3 forces : chapitres complétés avec diagnostic réussi
  const forces = allChapitres
    .filter(({ chap }) => store.completedChapters.includes(chap.id))
    .map(({ catKey, chap }) => {
      const diag = store.diagnosticResults[chap.id];
      const score = diag ? Math.round((diag.score / diag.total) * 100) : 70;
      return { catKey, chap, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  // Top 3 priorités : révisions SRS dues + chapitres avec mauvais diagnostic
  const dueReviews = store.getDueReviews();
  const weakChapters = allChapitres
    .filter(({ chap }) => {
      const diag = store.diagnosticResults[chap.id];
      return diag && diag.score / diag.total < 0.6;
    })
    .map(({ catKey, chap }) => {
      const diag = store.diagnosticResults[chap.id]!;
      return { catKey, chap, score: Math.round((diag.score / diag.total) * 100) };
    });

  const srsChapters = dueReviews
    .map((chapId) => {
      const found = allChapitres.find(({ chap }) => chap.id === chapId);
      return found ? { catKey: found.catKey, chap: found.chap, score: 50 } : null;
    })
    .filter(Boolean) as { catKey: string; chap: (typeof allChapitres)[0]['chap']; score: number }[];

  const priorités = [...srsChapters, ...weakChapters]
    .filter((item, idx, arr) => arr.findIndex((x) => x.chap.id === item.chap.id) === idx)
    .slice(0, 3);

  // Recommandation du jour
  const recommandation = getRecommandation(store.totalXP, store.streak, dueReviews.length, forces.length);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-800" />
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">Synthèse personnalisée</h2>
        <div className="h-px flex-1 bg-slate-800" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Forces */}
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="rounded-lg bg-emerald-500/20 p-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Tes points forts</h3>
              <p className="text-[10px] text-slate-500">chapitres maîtrisés</p>
            </div>
          </div>
          {forces.length > 0 ? (
            <div className="space-y-2.5">
              {forces.map(({ catKey, chap, score }) => (
                <motion.button
                  key={chap.id}
                  whileHover={{ x: 4 }}
                  onClick={() => onNavigateToChap(catKey, chap.id)}
                  className="w-full text-left flex items-center justify-between rounded-xl bg-slate-900/60 border border-slate-800 px-3 py-2.5 hover:border-emerald-500/30 transition-all group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Star className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span className="text-sm text-white truncate group-hover:text-emerald-300 transition-colors">
                      {chap.titre}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 shrink-0 ml-2">{score}%</span>
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <BookOpen className="h-8 w-8 text-slate-700" />
              <p className="text-sm text-slate-500">Complète tes premiers chapitres pour voir tes points forts</p>
            </div>
          )}
        </div>

        {/* Priorités */}
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="rounded-lg bg-amber-500/20 p-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Priorités de révision</h3>
              <p className="text-[10px] text-slate-500">à travailler en premier</p>
            </div>
          </div>
          {priorités.length > 0 ? (
            <div className="space-y-2.5">
              {priorités.map(({ catKey, chap, score }) => {
                const isDue = dueReviews.includes(chap.id);
                return (
                  <motion.button
                    key={chap.id}
                    whileHover={{ x: 4 }}
                    onClick={() => onNavigateToChap(catKey, chap.id)}
                    className="w-full text-left flex items-center justify-between rounded-xl bg-slate-900/60 border border-slate-800 px-3 py-2.5 hover:border-amber-500/30 transition-all group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isDue ? (
                        <RefreshCw className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      )}
                      <span className="text-sm text-white truncate group-hover:text-amber-300 transition-colors">
                        {chap.titre}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {isDue && (
                        <span className="rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-[9px] font-bold text-cyan-400 border border-cyan-500/30">
                          SRS
                        </span>
                      )}
                      <span className="text-xs font-bold text-amber-400">{score}%</span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <Target className="h-8 w-8 text-slate-700" />
              <p className="text-sm text-slate-500">Fais le diagnostic de tes chapitres pour voir les priorités</p>
            </div>
          )}
        </div>
      </div>

      {/* Recommandation du jour */}
      <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-950/40 to-indigo-950/40 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-blue-500/20 p-2.5 shrink-0 mt-0.5">
            <Target className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-1">
              Recommandation du jour
            </div>
            <p className="text-sm text-slate-200 leading-relaxed">{recommandation}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

function getRecommandation(xp: number, streak: number, dueReviews: number, forcesCount: number): string {
  if (dueReviews >= 3) {
    return `Tu as ${dueReviews} révisions SRS en attente. Commence par les révisions recommandées pour consolider tes acquis avant d'attaquer de nouveaux chapitres.`;
  }
  if (streak === 0) {
    return 'Reprends dès aujourd\'hui ! Même 20 minutes de travail régulier font une différence énorme sur la durée. Lance un chapitre ou le défi du jour.';
  }
  if (streak >= 7) {
    return `Excellente série de ${streak} jours ! Pour capitaliser, concentre-toi sur un chapitre difficile que tu repousses. C'est maintenant que ça compte.`;
  }
  if (forcesCount >= 3) {
    return 'Tu as de bonnes bases. Maintenant, attaque les chapitres les plus pointus (probabilités, exponentielle) pour viser un profil complet à l\'épreuve.';
  }
  return 'Travaille régulièrement 30 à 45 min par jour : un chapitre, quelques exercices, et la révision SRS. La constance bat l\'intensité ponctuelle.';
}
