'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  BookOpen,
  GraduationCap,
  Target,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Play,
  Timer,
  Code2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { computeStats } from '@/lib/nsi-pratique-2026/recommendations';
import type { Recommendation } from '@/lib/nsi-pratique-2026/recommendations';

interface NsiHeroProps {
  stats: ReturnType<typeof computeStats>;
  recommendation: Recommendation | null;
  onNavigate: (section: string) => void;
}

function CircularProgress({ value, size = 80 }: { value: number; size?: number }) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-neutral-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-brand-primary transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-neutral-100">{Math.round(value)}%</span>
      </div>
    </div>
  );
}

export function NsiHero({ stats, recommendation, onNavigate }: NsiHeroProps) {
  const prefersReducedMotion = useReducedMotion();
  const progressPercent =
    stats.totalSubjects > 0
      ? (stats.subjectsMastered / stats.totalSubjects) * 100
      : 0;

  return (
    <motion.section
      initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-8"
    >
      {/* Title area */}
      <div className="text-center space-y-4">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white"
        >
          Opération commando NSI 2026
        </motion.h1>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="flex flex-wrap justify-center gap-2"
        >
          <Badge variant="default">
            <GraduationCap className="mr-1 h-3 w-3" />
            Terminale NSI
          </Badge>
          <Badge variant="outline">
            <BookOpen className="mr-1 h-3 w-3" />
            Baccalauréat 2026
          </Badge>
          <Badge variant="success">
            <Target className="mr-1 h-3 w-3" />
            Entraînement actif
          </Badge>
        </motion.div>
      </div>

      {/* Stats row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-4"
      >
        <div className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-surface-card p-4">
          <CircularProgress value={progressPercent} />
          <span className="text-xs text-neutral-400 text-center">Progression globale</span>
        </div>

        <div className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-surface-card p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-semantic-success" />
            <span className="text-2xl font-bold text-white">
              {stats.subjectsMastered}
              <span className="text-sm text-neutral-400"> / {stats.totalSubjects}</span>
            </span>
          </div>
          <span className="text-xs text-neutral-400 text-center">Sujets maîtrisés</span>
        </div>

        <div className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-surface-card p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-semantic-warning" />
            <span className="text-2xl font-bold text-white">{stats.subjectsToReview}</span>
          </div>
          <span className="text-xs text-neutral-400 text-center">Sujets à revoir</span>
        </div>

        <div className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-surface-card p-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-brand-primary" />
          </div>
          <span className="text-xs text-neutral-300 text-center line-clamp-2">
            {recommendation?.label ?? 'Tout est maîtrisé !'}
          </span>
        </div>
      </motion.div>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="flex flex-wrap justify-center gap-3"
      >
        <Button
          variant="default"
          size="lg"
          onClick={() => onNavigate('subjects')}
        >
          <Play className="mr-2 h-4 w-4" />
          Commencer ma révision
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() => onNavigate('mock')}
        >
          <Timer className="mr-2 h-4 w-4" />
          Lancer un sujet blanc
        </Button>
        <Button
          variant="ghost"
          size="lg"
          onClick={() => onNavigate('patterns')}
        >
          <Code2 className="mr-2 h-4 w-4" />
          Revoir les patrons de code
        </Button>
      </motion.div>
    </motion.section>
  );
}
