'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Pause,
  Shuffle,
  Clock,
  Save,
  Star,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type {
  NsiSubject,
  NsiProgress,
  MockExamResult,
} from '@/data/nsi-pratique-2026/types';

interface NsiMockExamProps {
  subjects: NsiSubject[];
  progress: NsiProgress;
  onComplete: (result: MockExamResult) => void;
}

type ExamPhase = 'idle' | 'lecture' | 'codage' | 'tests' | 'relecture' | 'done';

const PHASES: { phase: ExamPhase; label: string; durationSec: number }[] = [
  { phase: 'lecture', label: 'Lecture de l\'énoncé', durationSec: 5 * 60 },
  { phase: 'codage', label: 'Codage', durationSec: 35 * 60 },
  { phase: 'tests', label: 'Tests', durationSec: 10 * 60 },
  { phase: 'relecture', label: 'Relecture / Oral', durationSec: 5 * 60 },
];

const TOTAL_SECONDS = PHASES.reduce((s, p) => s + p.durationSec, 0);

const CHECKLIST_ITEMS = [
  { key: 'signatures', label: "J'ai lu les signatures de chaque fonction" },
  { key: 'tests', label: "J'ai lancé les tests fournis" },
  { key: 'edge-cases', label: "J'ai traité les cas limites" },
  { key: 'explain', label: 'Je peux expliquer chaque fonction à voix haute' },
  { key: 'files', label: "J'ai vérifié les fichiers fournis" },
];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function NsiMockExam({ subjects, progress, onComplete }: NsiMockExamProps) {
  const [excludeMastered, setExcludeMastered] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<NsiSubject | null>(null);
  const [phase, setPhase] = useState<ExamPhase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [selfScore, setSelfScore] = useState(3);
  const [notes, setNotes] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pick random subject
  const pickRandom = useCallback(() => {
    let pool = subjects;
    if (excludeMastered) {
      pool = subjects.filter(
        (s) => progress.subjects[s.id]?.status !== 'mastered'
      );
    }
    if (pool.length === 0) pool = subjects;
    const idx = Math.floor(Math.random() * pool.length);
    setSelectedSubject(pool[idx]);
    setPhase('idle');
    setElapsed(0);
    setPaused(false);
    setChecklist({});
    setSelfScore(3);
    setNotes('');
  }, [subjects, excludeMastered, progress]);

  // Timer
  useEffect(() => {
    if (phase === 'idle' || phase === 'done' || paused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= TOTAL_SECONDS) {
          setPhase('done');
          return TOTAL_SECONDS;
        }
        // Auto-advance phase
        let cumulative = 0;
        for (const p of PHASES) {
          cumulative += p.durationSec;
          if (next < cumulative) {
            setPhase(p.phase);
            break;
          }
        }
        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, paused]);

  const startExam = useCallback(() => {
    if (!selectedSubject) return;
    setPhase('lecture');
    setElapsed(0);
    setPaused(false);
  }, [selectedSubject]);

  const getCurrentPhaseInfo = () => {
    let cumulative = 0;
    for (const p of PHASES) {
      cumulative += p.durationSec;
      if (elapsed < cumulative) {
        const phaseElapsed = elapsed - (cumulative - p.durationSec);
        const phaseRemaining = p.durationSec - phaseElapsed;
        return { ...p, phaseRemaining, phaseElapsed };
      }
    }
    return null;
  };

  const handleComplete = useCallback(() => {
    if (!selectedSubject) return;
    const result: MockExamResult = {
      subjectId: selectedSubject.id,
      date: new Date().toISOString(),
      completedSteps: Object.entries(checklist)
        .filter(([, v]) => v)
        .map(([k]) => k),
      selfScore,
      notes: notes || undefined,
    };
    onComplete(result);
    setPhase('idle');
    setSelectedSubject(null);
  }, [selectedSubject, checklist, selfScore, notes, onComplete]);

  const phaseInfo = getCurrentPhaseInfo();
  const overallProgress = Math.min(100, (elapsed / TOTAL_SECONDS) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Subject picker */}
      {phase === 'idle' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sujet blanc</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={excludeMastered}
                onCheckedChange={(checked) => setExcludeMastered(checked === true)}
              />
              <span className="text-sm text-neutral-300">
                Exclure les sujets maîtrisés
              </span>
            </label>

            <Button variant="default" onClick={pickRandom}>
              <Shuffle className="mr-2 h-4 w-4" />
              Tirer un sujet au hasard
            </Button>

            {selectedSubject && (
              <div className="rounded-xl border border-white/10 bg-surface-elevated p-4 space-y-2">
                <p className="text-sm text-neutral-400">Sujet tiré :</p>
                <p className="text-lg font-bold text-white">
                  #{selectedSubject.id} — {selectedSubject.title}
                </p>
                <div className="flex gap-2">
                  <Badge variant="outline">{selectedSubject.family}</Badge>
                  <Badge variant="outline">
                    <Clock className="mr-1 h-3 w-3" />
                    55 min
                  </Badge>
                </div>
                <Button variant="default" className="mt-2" onClick={startExam}>
                  <Play className="mr-2 h-4 w-4" />
                  Démarrer l&apos;examen
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Timer during exam */}
      {phase !== 'idle' && phase !== 'done' && selectedSubject && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-neutral-400">
                    #{selectedSubject.id} — {selectedSubject.title}
                  </p>
                  <p className="text-sm font-medium text-white">
                    {phaseInfo?.label}
                  </p>
                </div>
                <div className="text-right" role="status" aria-live="polite">
                  <p className="text-2xl font-mono font-bold text-white">
                    {formatTime(TOTAL_SECONDS - elapsed)}
                  </p>
                  <p className="text-xs text-neutral-500">restant</p>
                </div>
              </div>

              <Progress value={overallProgress} />

              {/* Phase indicators */}
              <div className="flex gap-1">
                {PHASES.map((p) => {
                  const isActive = phase === p.phase;
                  const cumStart = PHASES.slice(0, PHASES.indexOf(p)).reduce(
                    (s, x) => s + x.durationSec,
                    0
                  );
                  const isDone = elapsed >= cumStart + p.durationSec;

                  return (
                    <div
                      key={p.phase}
                      className={cn(
                        'flex-1 rounded-md py-1 px-2 text-center text-[10px] border',
                        isActive
                          ? 'bg-brand-primary/20 border-brand-primary/40 text-white'
                          : isDone
                          ? 'bg-semantic-success/10 border-semantic-success/30 text-semantic-success'
                          : 'bg-surface-elevated border-white/5 text-neutral-500'
                      )}
                    >
                      {p.label}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaused(!paused)}
                >
                  {paused ? (
                    <Play className="mr-1 h-3 w-3" />
                  ) : (
                    <Pause className="mr-1 h-3 w-3" />
                  )}
                  {paused ? 'Reprendre' : 'Pause'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPhase('done')}
                >
                  Terminer maintenant
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Checklist */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Checklist de vérification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {CHECKLIST_ITEMS.map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={checklist[item.key] ?? false}
                    onCheckedChange={(checked) =>
                      setChecklist((prev) => ({
                        ...prev,
                        [item.key]: checked === true,
                      }))
                    }
                  />
                  <span
                    className={cn(
                      'text-sm',
                      checklist[item.key]
                        ? 'text-neutral-400 line-through'
                        : 'text-neutral-200'
                    )}
                  >
                    {item.label}
                  </span>
                </label>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {/* Self-evaluation after exam */}
      {phase === 'done' && selectedSubject && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Auto-évaluation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-neutral-400">
              #{selectedSubject.id} — {selectedSubject.title}
            </p>

            {/* Score */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-400">
                Note de confiance (1 à 5)
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((score) => (
                  <button
                    key={score}
                    aria-label={`Note ${score} sur 5`}
                    className={cn(
                      'h-10 w-10 rounded-lg border flex items-center justify-center transition-colors',
                      selfScore >= score
                        ? 'bg-brand-primary border-brand-primary text-white'
                        : 'bg-surface-elevated border-white/10 text-neutral-500'
                    )}
                    onClick={() => setSelfScore(score)}
                  >
                    <Star
                      className="h-4 w-4"
                      fill={selfScore >= score ? 'currentColor' : 'none'}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-400">
                Notes personnelles
              </label>
              <textarea
                className="w-full rounded-lg border border-white/15 bg-surface-elevated text-neutral-100 px-3 py-2 text-sm placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
                rows={3}
                placeholder="Ce qui a bien fonctionné, ce qui était difficile..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Checklist summary */}
            <div className="text-xs text-neutral-400">
              Checklist : {Object.values(checklist).filter(Boolean).length} /{' '}
              {CHECKLIST_ITEMS.length} validés
            </div>

            <Button variant="default" onClick={handleComplete}>
              <Save className="mr-2 h-4 w-4" />
              Enregistrer le résultat
            </Button>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
