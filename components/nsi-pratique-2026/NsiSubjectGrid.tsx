'use client';

import { useState, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Search,
  BookOpen,
  Code2,
  MessageSquare,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type {
  NsiSubject,
  NsiProgress,
  SubjectStatus,
  SubjectDifficulty,
} from '@/data/nsi-pratique-2026/types';

interface NsiSubjectGridProps {
  subjects: NsiSubject[];
  progress: NsiProgress;
  onSelectSubject: (id: number) => void;
}

const DIFFICULTY_COLORS: Record<SubjectDifficulty, string> = {
  facile: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
  moyen: 'border-blue-500/40 bg-blue-500/15 text-blue-300',
  difficile: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
  expert: 'border-red-500/40 bg-red-500/15 text-red-300',
};

const STATUS_CONFIG: Record<
  SubjectStatus,
  { label: string; dotColor: string }
> = {
  not_started: { label: 'Non commencé', dotColor: 'bg-neutral-500' },
  read: { label: 'Lu', dotColor: 'bg-blue-400' },
  coded: { label: 'Codé', dotColor: 'bg-cyan-400' },
  tested: { label: 'Testé', dotColor: 'bg-purple-400' },
  explained: { label: 'Expliqué', dotColor: 'bg-indigo-400' },
  mastered: { label: 'Maîtrisé', dotColor: 'bg-emerald-400' },
  needs_review: { label: 'À revoir', dotColor: 'bg-amber-400' },
};

type FilterStatus = SubjectStatus | 'all';

function NsiSubjectCard({
  subject,
  status,
  onSelect,
}: {
  subject: NsiSubject;
  status: SubjectStatus;
  onSelect: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const statusCfg = STATUS_CONFIG[status];

  return (
    <motion.div
      whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-mono text-neutral-500">#{subject.id}</span>
              <CardTitle className="text-sm leading-tight truncate">
                {subject.title}
              </CardTitle>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={cn('h-2 w-2 rounded-full', statusCfg.dotColor)} />
              <span className="text-[10px] text-neutral-400">{statusCfg.label}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {subject.family}
            </Badge>
            <Badge className={cn('text-[10px] px-1.5 py-0 border', DIFFICULTY_COLORS[subject.difficulty])}>
              {subject.difficulty}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-3 pt-0">
          {/* Files */}
          {subject.files.python && subject.files.python.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {subject.files.python.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1 text-[10px] text-neutral-400 bg-surface-elevated rounded px-1.5 py-0.5"
                >
                  <FileText className="h-2.5 w-2.5" />
                  {f}
                </span>
              ))}
            </div>
          )}

          {/* Mnemonic truncated */}
          <p className="text-xs text-neutral-400 line-clamp-2 italic">
            {subject.mnemonic}
          </p>

          {/* Actions */}
          <div className="mt-auto flex gap-2">
            <Button
              variant="default"
              size="sm"
              className="flex-1 text-xs"
              onClick={onSelect}
            >
              <BookOpen className="mr-1 h-3 w-3" />
              Réviser
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs px-2"
              onClick={onSelect}
            >
              <Code2 className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs px-2"
              onClick={onSelect}
            >
              <MessageSquare className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function NsiSubjectGrid({
  subjects,
  progress,
  onSelectSubject,
}: NsiSubjectGridProps) {
  const [search, setSearch] = useState('');
  const [familyFilter, setFamilyFilter] = useState<string | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<SubjectDifficulty | null>(null);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');

  const families = useMemo(
    () => Array.from(new Set(subjects.map((s) => s.family))),
    [subjects]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return subjects.filter((s) => {
      if (q) {
        const matchesSearch =
          s.title.toLowerCase().includes(q) ||
          s.concepts.some((c) => c.toLowerCase().includes(q)) ||
          s.family.toLowerCase().includes(q) ||
          (s.files.python ?? []).some((f) => f.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }
      if (familyFilter && s.family !== familyFilter) return false;
      if (difficultyFilter && s.difficulty !== difficultyFilter) return false;
      if (statusFilter !== 'all') {
        const subjectStatus = progress.subjects[s.id]?.status ?? 'not_started';
        if (subjectStatus !== statusFilter) return false;
      }
      return true;
    });
  }, [subjects, search, familyFilter, difficultyFilter, statusFilter, progress]);

  return (
    <div className="space-y-4">
      {/* Search */}
      <Input
        placeholder="Rechercher par titre, concept, fichier..."
        icon={<Search className="h-4 w-4" />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {/* Family filters */}
        {families.map((fam) => (
          <Badge
            key={fam}
            variant={familyFilter === fam ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setFamilyFilter(familyFilter === fam ? null : fam)}
          >
            {fam}
          </Badge>
        ))}
        <span className="w-px h-6 bg-neutral-700" />
        {/* Difficulty */}
        {(['facile', 'moyen', 'difficile', 'expert'] as SubjectDifficulty[]).map((d) => (
          <Badge
            key={d}
            className={cn(
              'cursor-pointer border',
              difficultyFilter === d ? DIFFICULTY_COLORS[d] : 'border-neutral-700 text-neutral-400'
            )}
            onClick={() => setDifficultyFilter(difficultyFilter === d ? null : d)}
          >
            {d}
          </Badge>
        ))}
        <span className="w-px h-6 bg-neutral-700" />
        {/* Status */}
        {(['mastered', 'needs_review', 'not_started'] as SubjectStatus[]).map((st) => (
          <Badge
            key={st}
            variant={statusFilter === st ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setStatusFilter(statusFilter === st ? 'all' : st)}
          >
            <span className={cn('h-2 w-2 rounded-full mr-1', STATUS_CONFIG[st].dotColor)} />
            {STATUS_CONFIG[st].label}
          </Badge>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((subject) => (
          <NsiSubjectCard
            key={subject.id}
            subject={subject}
            status={progress.subjects[subject.id]?.status ?? 'not_started'}
            onSelect={() => onSelectSubject(subject.id)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-neutral-500 py-12">
          Aucun sujet ne correspond aux filtres.
        </p>
      )}
    </div>
  );
}
