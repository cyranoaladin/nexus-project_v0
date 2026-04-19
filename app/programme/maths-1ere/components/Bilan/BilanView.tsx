'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Users,
  Award,
  ChevronDown,
  ChevronUp,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Target,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import { useMathsLabStore } from '../../store';
import { programmeData } from '../../data';
import { STAGE_PRINTEMPS_2026, getDaysUntilExam } from '../../config/stage';

type BilanType = 'eleve' | 'famille' | 'nexus';

interface BilanViewProps {
  displayName: string;
}

export const BilanView: React.FC<BilanViewProps> = ({ displayName }) => {
  const [activeBilan, setActiveBilan] = useState<BilanType>('eleve');
  const [openSections, setOpenSections] = useState<string[]>(['resume']);
  const store = useMathsLabStore();

  const allChapitres = Object.entries(programmeData).flatMap(([catKey, cat]) =>
    cat.chapitres.map((chap) => ({ catKey, chap }))
  );

  const daysUntilExam = getDaysUntilExam();
  const niveau = store.getNiveau();
  const completed = store.completedChapters.length;
  const total = allChapitres.length;
  const coverage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const dueReviews = store.getDueReviews().length;

  const diagResults = Object.entries(store.diagnosticResults).map(([chapId, result]) => {
    const found = allChapitres.find(({ chap }) => chap.id === chapId);
    return {
      chapId,
      chapTitre: found?.chap.titre ?? chapId,
      percent: Math.round((result.score / result.total) * 100),
    };
  });

  const forces = diagResults.filter((d) => d.percent >= 75).slice(0, 3);
  const priorites = diagResults.filter((d) => d.percent < 60).slice(0, 3);

  const toggleSection = (id: string) => {
    setOpenSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const bilanTabs: { id: BilanType; label: string; icon: React.ReactNode; description: string }[] = [
    {
      id: 'eleve',
      label: 'Bilan Élève',
      icon: <Target className="h-4 w-4" />,
      description: 'Synthèse personnalisée pour guider les révisions',
    },
    {
      id: 'famille',
      label: 'Bilan Famille',
      icon: <Users className="h-4 w-4" />,
      description: 'Rapport pour les parents (format communication Nexus)',
    },
    {
      id: 'nexus',
      label: 'Fiche Nexus',
      icon: <Award className="h-4 w-4" />,
      description: 'Fiche technique pour l\'équipe pédagogique',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-slate-700/40 bg-slate-900/60 p-6">
        <h1 className="text-2xl font-black text-white mb-1">Bilan & Plan de révision</h1>
        <p className="text-sm text-slate-400">
          Synthèse après stage · {daysUntilExam} jours avant l&apos;épreuve anticipée
        </p>
      </div>

      {/* Bilan type selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {bilanTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveBilan(tab.id)}
            className={`rounded-2xl border p-4 text-left transition-all ${
              activeBilan === tab.id
                ? 'border-cyan-500/30 bg-cyan-500/10 shadow-lg shadow-cyan-500/5'
                : 'border-slate-700/40 bg-slate-900/30 hover:border-slate-600/50'
            }`}
          >
            <div className={`flex items-center gap-2 mb-2 ${activeBilan === tab.id ? 'text-cyan-400' : 'text-slate-400'}`}>
              {tab.icon}
              <span className="font-bold text-sm">{tab.label}</span>
            </div>
            <p className="text-xs text-slate-500">{tab.description}</p>
          </button>
        ))}
      </div>

      {/* Bilan Élève */}
      {activeBilan === 'eleve' && (
        <div className="space-y-4">
          <BilanSection
            id="resume"
            title="Résumé 15 secondes"
            icon={<Target className="h-4 w-4 text-cyan-400" />}
            open={openSections.includes('resume')}
            onToggle={() => toggleSection('resume')}
          >
            <div className="space-y-2">
              <BilanPoint
                type="force"
                text={forces.length > 0
                  ? `Ta force principale : ${forces[0]?.chapTitre ?? 'en cours d\'identification'} — continue à consolider.`
                  : 'Continue à faire les diagnostics pour identifier tes forces.'}
              />
              <BilanPoint
                type="priority"
                text={priorites.length > 0
                  ? `Ta priorité numéro 1 : ${priorites[0]?.chapTitre ?? 'à identifier'} — c\'est là que tu gagneras le plus de points.`
                  : dueReviews > 0
                  ? `${dueReviews} révision(s) SRS en attente : ne laisse pas l\'avance accumulée se perdre.`
                  : 'Fais les diagnostics de chapitre pour cibler tes priorités.'}
              />
              <BilanPoint
                type="goal"
                text={`Objectif 2 semaines : atteindre ${Math.min(100, coverage + 20)}% de couverture du programme et maîtriser les automatismes à 100%.`}
              />
            </div>
          </BilanSection>

          <BilanSection
            id="niveau"
            title="Ton niveau actuel"
            icon={<TrendingUp className="h-4 w-4 text-blue-400" />}
            open={openSections.includes('niveau')}
            onToggle={() => toggleSection('niveau')}
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard label="Niveau" value={niveau.nom} />
              <MetricCard label="Programme couvert" value={`${coverage}%`} />
              <MetricCard label="XP total" value={`${store.totalXP}`} />
              <MetricCard label="Série" value={`${store.streak} j`} />
            </div>
          </BilanSection>

          <BilanSection
            id="priorites"
            title="Tes 3 priorités avec exercices"
            icon={<AlertTriangle className="h-4 w-4 text-amber-400" />}
            open={openSections.includes('priorites')}
            onToggle={() => toggleSection('priorites')}
          >
            {priorites.length > 0 ? (
              <div className="space-y-3">
                {priorites.map((p, i) => (
                  <div key={p.chapId} className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-xs font-bold text-amber-400">
                        #{i + 1}
                      </span>
                      <span className="font-bold text-white text-sm">{p.chapTitre}</span>
                      <span className="ml-auto text-xs text-red-400 font-bold">{p.percent}%</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Pourquoi c&apos;est prioritaire : ce chapitre est directement évalué dans les 14 pts exercices de l&apos;épreuve anticipée. Un gain de 10 points ici = potentiellement +1,4 pt à l&apos;examen.
                    </p>
                    <div className="mt-2 rounded-lg bg-blue-500/5 border border-blue-500/15 p-2.5">
                      <p className="text-xs text-blue-300">
                        <strong>Exercice 5 min :</strong> Refais le diagnostic du chapitre, puis tente l&apos;exercice d&apos;application sans regarder le cours. Note les points de blocage.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Fais les diagnostics de chapitre pour identifier tes priorités personnalisées.
              </p>
            )}
          </BilanSection>

          <BilanSection
            id="plan"
            title="Plan 2 semaines"
            icon={<Calendar className="h-4 w-4 text-green-400" />}
            open={openSections.includes('plan')}
            onToggle={() => toggleSection('plan')}
          >
            <div className="space-y-3">
              {[
                { semaine: 'Semaine 1', objectif: `Consolider ${priorites[0]?.chapTitre ?? 'les priorités identifiées'} + révisions SRS quotidiennes (20 min/jour)` },
                { semaine: 'Semaine 2', objectif: `Travailler ${priorites[1]?.chapTitre ?? 'un deuxième chapitre prioritaire'} + mini-épreuve blanche en fin de semaine` },
              ].map((item, i) => (
                <div key={i} className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-4">
                  <div className="font-bold text-cyan-400 text-xs uppercase tracking-wider mb-1">{item.semaine}</div>
                  <p className="text-sm text-slate-300">{item.objectif}</p>
                </div>
              ))}
              <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                <div className="font-bold text-green-400 text-xs uppercase tracking-wider mb-1">Routine quotidienne recommandée</div>
                <div className="space-y-1">
                  {[
                    '10 min — Révisions SRS (plateforme)',
                    '20 min — Chapitre prioritaire ou exercice',
                    '5 min — Automatismes sans calculatrice',
                  ].map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      {r}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </BilanSection>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/40 px-5 py-3 text-sm font-bold text-slate-300 hover:text-white hover:border-slate-600 transition-all"
          >
            <Printer className="h-4 w-4" />
            Imprimer mon bilan
          </button>
        </div>
      )}

      {/* Bilan Famille */}
      {activeBilan === 'famille' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-700/40 bg-slate-900/40 p-6">
            <div className="mb-6 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center font-black text-white">N</div>
                <div>
                  <div className="font-bold text-white">Nexus Réussite</div>
                  <div className="text-xs text-slate-500">Rapport de progression — Stage de Printemps 2026</div>
                </div>
              </div>
              <div className="text-xs text-slate-500">Élève : <span className="text-white font-bold">{displayName}</span> · Niveau Première Générale · Spécialité Mathématiques</div>
            </div>

            <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
              <div>
                <h3 className="font-bold text-white mb-2">Où en est {displayName} ?</h3>
                <p>
                  {displayName} a suivi le stage de printemps Nexus Réussite du {STAGE_PRINTEMPS_2026.debut} au {STAGE_PRINTEMPS_2026.fin}, soit{' '}
                  <strong className="text-white">{STAGE_PRINTEMPS_2026.heuresMaths} heures de mathématiques</strong> en présentiel.
                  Sur la plateforme numérique, {displayName} a complété <strong className="text-white">{completed} chapitre{completed > 1 ? 's' : ''}</strong>{' '}
                  sur {total} au programme, avec un taux de couverture de <strong className="text-white">{coverage}%</strong>.
                </p>
              </div>

              {forces.length > 0 && (
                <div>
                  <h3 className="font-bold text-white mb-2">Points positifs</h3>
                  <div className="space-y-1">
                    {forces.map((f) => (
                      <div key={f.chapId} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        <span>{f.chapTitre} — bien maîtrisé ({f.percent}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-bold text-white mb-2">Points d&apos;attention</h3>
                <p>
                  {priorites.length > 0
                    ? `Nous recommandons de travailler particulièrement sur : ${priorites.map((p) => p.chapTitre).join(', ')}. Ces notions sont directement évaluées lors de l'épreuve anticipée.`
                    : 'Les diagnostics sont en cours. Nous vous communiquerons les points d\'attention après les premières séances.'}
                </p>
              </div>

              <div>
                <h3 className="font-bold text-white mb-2">Ce que Nexus va faire</h3>
                <div className="space-y-1">
                  {STAGE_PRINTEMPS_2026.promessesNexus.slice(0, 5).map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-cyan-500 shrink-0" />
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-bold text-white mb-2">Comment aider à la maison</h3>
                <div className="space-y-1">
                  {[
                    '30 à 45 minutes de travail régulier quotidien (pas de session marathon rare)',
                    'Vérifier que les révisions SRS sont faites chaque soir (plateforme)',
                    'Encourager sans faire à la place — la démarche compte autant que le résultat',
                  ].map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-cyan-500">·</span>
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4">
                <p className="text-xs text-blue-300">
                  <strong>Indicateur de progrès mesurable :</strong> dans 2 semaines, nous visons un score d&apos;au moins 80% sur les automatismes et une couverture de {Math.min(100, coverage + 20)}% du programme.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/40 px-5 py-3 text-sm font-bold text-slate-300 hover:text-white hover:border-slate-600 transition-all"
          >
            <Printer className="h-4 w-4" />
            Imprimer / Partager avec la famille
          </button>
        </div>
      )}

      {/* Fiche Nexus */}
      {activeBilan === 'nexus' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-violet-500/20 bg-slate-900/40 p-5">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <Award className="h-4 w-4 text-violet-400" />
              Fiche pédagogique — Usage interne Nexus
            </h3>
            <div className="font-mono text-xs text-slate-300 leading-relaxed space-y-4">
              <div>
                <div className="text-violet-400 font-bold mb-1">DATA QUALITY</div>
                <div className="space-y-0.5">
                  <div>Chapitres diagnostiqués : {diagResults.length}/{total}</div>
                  <div>Couverture programme : {coverage}%</div>
                  <div>Données manquantes : {total - diagResults.length} chapitres sans diagnostic</div>
                </div>
              </div>
              <div>
                <div className="text-emerald-400 font-bold mb-1">FORCES (score ≥ 75%)</div>
                {forces.length > 0 ? forces.map((f) => (
                  <div key={f.chapId}>· {f.chapTitre} — {f.percent}%</div>
                )) : <div>Données insuffisantes</div>}
              </div>
              <div>
                <div className="text-red-400 font-bold mb-1">LACUNES PRIORITAIRES (score &lt; 60%)</div>
                {priorites.length > 0 ? priorites.map((p) => (
                  <div key={p.chapId}>· {p.chapTitre} — {p.percent}%</div>
                )) : <div>Aucune lacune critique identifiée</div>}
              </div>
              <div>
                <div className="text-amber-400 font-bold mb-1">ALERTES</div>
                {dueReviews > 0 && <div>! {dueReviews} révision(s) SRS en retard → risque de perte des acquis</div>}
                {coverage < 50 && <div>! Couverture programme insuffisante ({coverage}%) → séances collectives à prioriser</div>}
                {dueReviews === 0 && coverage >= 50 && <div>Aucune alerte critique détectée.</div>}
              </div>
              <div>
                <div className="text-blue-400 font-bold mb-1">RECOMMANDATION STAGE</div>
                <div>Groupe : {coverage >= 70 ? 'A (autonome)' : coverage >= 40 ? 'B (intermédiaire)' : 'C (soutien renforcé)'}</div>
                <div>Séquence recommandée : {priorites.length > 0 ? priorites.map((p) => p.chapTitre).join(' → ') : 'À définir après diagnostics'}</div>
              </div>
            </div>
          </div>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/40 px-5 py-3 text-sm font-bold text-slate-300 hover:text-white hover:border-slate-600 transition-all"
          >
            <Printer className="h-4 w-4" />
            Exporter fiche technique
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const BilanSection: React.FC<{
  id: string;
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ id, title, icon, open, onToggle, children }) => (
  <div className="rounded-2xl border border-slate-700/40 bg-slate-900/40 overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-800/30 transition-colors"
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="font-bold text-white text-sm">{title}</span>
      </div>
      {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
    </button>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="px-5 pb-5 border-t border-slate-800"
      >
        <div className="mt-4">{children}</div>
      </motion.div>
    )}
  </div>
);

const BilanPoint: React.FC<{ type: 'force' | 'priority' | 'goal'; text: string }> = ({ type, text }) => {
  const config = {
    force: { icon: <TrendingUp className="h-4 w-4 text-green-400" />, color: 'text-green-300' },
    priority: { icon: <AlertTriangle className="h-4 w-4 text-amber-400" />, color: 'text-amber-300' },
    goal: { icon: <Target className="h-4 w-4 text-blue-400" />, color: 'text-blue-300' },
  }[type];
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40 p-3">
      <div className="shrink-0 mt-0.5">{config.icon}</div>
      <p className={`text-sm leading-relaxed ${config.color}`}>{text}</p>
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-3 text-center">
    <div className="text-xl font-black text-white">{value}</div>
    <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{label}</div>
  </div>
);
