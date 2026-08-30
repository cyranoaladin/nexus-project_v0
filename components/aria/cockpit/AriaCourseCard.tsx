'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Lock, CheckCircle, BookOpen, Layers } from 'lucide-react';
import type { AriaCourseSummary } from '@/lib/aria/contracts';
import { AriaRagStatusBadge } from './AriaRagStatusBadge';

interface AriaCourseCardProps {
  course: AriaCourseSummary;
  isSelected?: boolean;
}

export const AriaCourseCard: React.FC<AriaCourseCardProps> = ({
  course,
  isSelected = false,
}) => {
  const { status } = course.access;
  const isAvailable = status === 'AVAILABLE';
  const isSetupRequired = status === 'SETUP_REQUIRED';
  const isLocked = status === 'LOCKED';

  return (
    <div
      className={`relative rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between ${
        isSelected
          ? 'border-sky-500 bg-slate-900/90 ring-1 ring-sky-500/50 shadow-lg shadow-sky-950/50'
          : isAvailable
          ? 'border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900/80'
          : 'border-slate-800/60 bg-slate-950/40 opacity-75'
      }`}
    >
      <div>
        {/* En-tête : Badges de statut et RAG */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <AriaRagStatusBadge
            hasRagCorpus={course.capabilities.hasRagCorpus}
            ragCollection={course.capabilities.ragCollection}
          />

          {isAvailable && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Actif</span>
            </span>
          )}

          {isSetupRequired && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
              <span>À configurer</span>
            </span>
          )}

          {isLocked && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              <Lock className="w-3 h-3" />
              <span>Verrouillé</span>
            </span>
          )}
        </div>

        {/* Titre et détails */}
        <h3 className="text-base font-semibold text-slate-100 mb-1 leading-snug">
          {course.label}
        </h3>
        <p className="text-xs text-slate-400 mb-4 line-clamp-2">
          {course.longLabel}
        </p>

        {/* Métriques : Ressources */}
        <div className="grid grid-cols-2 gap-2 py-2 border-y border-slate-800/60 text-xs text-slate-400 mb-4">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span>{course.capabilities.hasSkillGraph ? 'Compétences actives' : 'Tronc commun'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-slate-500" />
            <span>{course.capabilities.resourceCount} ressources</span>
          </div>
        </div>
      </div>

      {/* CTA action */}
      <div className="pt-2">
        {isAvailable ? (
          <Link
            href={`/dashboard/eleve/aria/${course.courseKey}`}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors shadow-sm"
          >
            <span>Entrer dans l'espace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        ) : isSetupRequired ? (
          <Link
            href={`/dashboard/eleve/aria/${course.courseKey}`}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            <span>Activer pour ARIA</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        ) : (
          <div className="w-full text-center py-2 px-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
            Formule ARIA non souscrite
          </div>
        )}
      </div>
    </div>
  );
};
