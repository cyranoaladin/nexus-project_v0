'use client';

import { motion } from 'framer-motion';
import {
  BookOpen,
  CheckCircle2,
  Code2,
  MessageSquare,
  Clock,
  History,
  ArrowRight,
  Shield,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { computeStats } from '@/lib/nsi-pratique-2026/recommendations';
import type { Recommendation } from '@/lib/nsi-pratique-2026/recommendations';
import type { NsiSubject } from '@/data/nsi-pratique-2026/types';

interface NsiProgressOverviewProps {
  stats: ReturnType<typeof computeStats>;
  recommendation: Recommendation | null;
  subjects: NsiSubject[];
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  index: number;
}

function StatCard({ icon, label, value, sub, index }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.35 }}
    >
      <Card className="h-full">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-neutral-400">{label}</p>
            {sub && <p className="mt-0.5 text-xs text-neutral-500 truncate">{sub}</p>}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function NsiProgressOverview({
  stats,
  recommendation,
  subjects,
}: NsiProgressOverviewProps) {
  const hours = Math.floor(stats.estimatedMinutesRemaining / 60);
  const minutes = stats.estimatedMinutesRemaining % 60;
  const timeLabel = hours > 0 ? `${hours}h${minutes.toString().padStart(2, '0')}` : `${minutes}min`;

  const lastSubjectTitle = stats.lastWorkedSubjectId
    ? subjects.find((s) => s.id === stats.lastWorkedSubjectId)?.shortTitle ?? `Sujet ${stats.lastWorkedSubjectId}`
    : 'Aucun';

  const nextSubjectTitle = recommendation?.subjectId
    ? subjects.find((s) => s.id === recommendation.subjectId)?.shortTitle ?? recommendation.label
    : recommendation?.label ?? 'Tout terminé';

  const readinessLabels: Record<string, string> = {
    ready: 'Prêt',
    almost: 'Presque prêt',
    consolidate: 'À consolider',
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <StatCard
        index={0}
        icon={<BookOpen className="h-5 w-5" />}
        label="Sujets vus"
        value={`${stats.subjectsSeen} / ${stats.totalSubjects}`}
      />
      <StatCard
        index={1}
        icon={<CheckCircle2 className="h-5 w-5" />}
        label="Sujets maîtrisés"
        value={stats.subjectsMastered}
      />
      <StatCard
        index={2}
        icon={<Code2 className="h-5 w-5" />}
        label="Patrons maîtrisés"
        value={`${stats.patternsMastered} / ${stats.totalPatterns}`}
      />
      <StatCard
        index={3}
        icon={<MessageSquare className="h-5 w-5" />}
        label="Questions d'oral travaillées"
        value={stats.oralQuestionsWorked}
      />
      <StatCard
        index={4}
        icon={<Clock className="h-5 w-5" />}
        label="Temps estimé restant"
        value={timeLabel}
      />
      <StatCard
        index={5}
        icon={<History className="h-5 w-5" />}
        label="Dernier sujet travaillé"
        value={lastSubjectTitle}
      />
      <StatCard
        index={6}
        icon={<ArrowRight className="h-5 w-5" />}
        label="Prochain sujet recommandé"
        value=""
        sub={nextSubjectTitle}
      />
      <StatCard
        index={7}
        icon={<Shield className="h-5 w-5" />}
        label="Niveau de préparation"
        value={readinessLabels[stats.readinessLevel] ?? 'À consolider'}
        sub={`${Math.round((stats.subjectsMastered / stats.totalSubjects) * 100)}% maîtrisé`}
      />
    </div>
  );
}
