'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  X,
  Clock,
  BookOpen,
  Code2,
  AlertTriangle,
  MessageSquare,
  Dumbbell,
  Eye,
  EyeOff,
  Check,
  RotateCcw,
  Save,
  ChevronRight,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NsiCodeBlock } from './NsiCodeBlock';
import type {
  NsiSubject,
  NsiPattern,
  NsiProgress,
  OralFourPhrases,
  TrainingTaskType,
} from '@/data/nsi-pratique-2026/types';

interface NsiSubjectDetailProps {
  subject: NsiSubject;
  patterns: NsiPattern[];
  progress: NsiProgress;
  onUpdateProgress: (update: Record<string, unknown>) => void;
  onClose: () => void;
}

const TASK_TYPE_COLORS: Record<TrainingTaskType, string> = {
  code: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  oral: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  quiz: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  memory: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  debug: 'bg-red-500/15 text-red-300 border-red-500/30',
};

export function NsiSubjectDetail({
  subject,
  patterns,
  progress,
  onUpdateProgress,
  onClose,
}: NsiSubjectDetailProps) {
  const prefersReducedMotion = useReducedMotion();
  const relatedPatterns = patterns.filter((p) =>
    subject.patterns.includes(p.id)
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-mono text-neutral-500">
              #{subject.id}
            </span>
            <h2 className="text-xl font-bold text-white">{subject.title}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{subject.family}</Badge>
            <Badge variant="outline">
              <Clock className="mr-1 h-3 w-3" />
              {subject.estimatedTimeMinutes} min
            </Badge>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer le détail du sujet">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full flex overflow-x-auto bg-surface-elevated border border-white/10">
          <TabsTrigger value="overview" className="text-xs data-[state=active]:bg-brand-primary/20 data-[state=active]:text-white text-neutral-400">
            <BookOpen className="mr-1 h-3 w-3" />
            Vue d&apos;ensemble
          </TabsTrigger>
          <TabsTrigger value="algorithm" className="text-xs data-[state=active]:bg-brand-primary/20 data-[state=active]:text-white text-neutral-400">
            Algorithme
          </TabsTrigger>
          <TabsTrigger value="code" className="text-xs data-[state=active]:bg-brand-primary/20 data-[state=active]:text-white text-neutral-400">
            <Code2 className="mr-1 h-3 w-3" />
            Code
          </TabsTrigger>
          <TabsTrigger value="traps" className="text-xs data-[state=active]:bg-brand-primary/20 data-[state=active]:text-white text-neutral-400">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Pièges
          </TabsTrigger>
          <TabsTrigger value="oral" className="text-xs data-[state=active]:bg-brand-primary/20 data-[state=active]:text-white text-neutral-400">
            <MessageSquare className="mr-1 h-3 w-3" />
            Oral
          </TabsTrigger>
          <TabsTrigger value="training" className="text-xs data-[state=active]:bg-brand-primary/20 data-[state=active]:text-white text-neutral-400">
            <Dumbbell className="mr-1 h-3 w-3" />
            Entraînement
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview */}
        <TabsContent value="overview">
          <OverviewTab subject={subject} relatedPatterns={relatedPatterns} />
        </TabsContent>

        {/* Tab 2: Algorithm */}
        <TabsContent value="algorithm">
          <AlgorithmTab
            subject={subject}
            progress={progress}
            onUpdateProgress={onUpdateProgress}
          />
        </TabsContent>

        {/* Tab 3: Code / Patterns */}
        <TabsContent value="code">
          <CodeTab relatedPatterns={relatedPatterns} />
        </TabsContent>

        {/* Tab 4: Traps */}
        <TabsContent value="traps">
          <TrapsTab subject={subject} />
        </TabsContent>

        {/* Tab 5: Oral */}
        <TabsContent value="oral">
          <OralTab subject={subject} progress={progress} onUpdateProgress={onUpdateProgress} />
        </TabsContent>

        {/* Tab 6: Training */}
        <TabsContent value="training">
          <TrainingTab subject={subject} />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

/* ---------- Sub-tab components ---------- */

function OverviewTab({
  subject,
  relatedPatterns,
}: {
  subject: NsiSubject;
  relatedPatterns: NsiPattern[];
}) {
  return (
    <div className="grid gap-4 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Thème et objectifs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-neutral-300">{subject.mnemonic}</p>
          <div className="flex flex-wrap gap-1.5">
            {subject.concepts.map((c) => (
              <Badge key={c} variant="outline" className="text-xs">
                {c}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Fichiers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {subject.files.python?.map((f) => (
              <span
                key={f}
                className="text-xs bg-surface-elevated border border-white/10 rounded px-2 py-1 text-neutral-300 font-mono"
              >
                {f}
              </span>
            ))}
            {subject.files.data?.map((f) => (
              <span
                key={f}
                className="text-xs bg-surface-elevated border border-white/10 rounded px-2 py-1 text-neutral-300 font-mono"
              >
                {f}
              </span>
            ))}
            {subject.files.database?.map((f) => (
              <span
                key={f}
                className="text-xs bg-surface-elevated border border-white/10 rounded px-2 py-1 text-neutral-300 font-mono"
              >
                {f}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {relatedPatterns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Patrons associés</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {relatedPatterns.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <Code2 className="h-3.5 w-3.5 text-brand-primary shrink-0" />
                <span className="text-sm text-neutral-300">{p.title}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Pièges principaux</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1">
            {subject.commonTraps.map((t, i) => (
              <li key={i} className="text-sm text-neutral-300 flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-semantic-warning shrink-0 mt-0.5" />
                {t}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Temps estimé</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-neutral-400" />
            <span className="text-sm text-neutral-300">
              {subject.estimatedTimeMinutes} minutes (révision) &mdash;{' '}
              {subject.examTimeMinutes} minutes (examen)
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AlgorithmTab({
  subject,
  progress,
  onUpdateProgress,
}: {
  subject: NsiSubject;
  progress: NsiProgress;
  onUpdateProgress: (update: Record<string, unknown>) => void;
}) {
  const existingPhrases = progress.oralPhrases[subject.id];
  const [phrases, setPhrases] = useState<OralFourPhrases>({
    contract: existingPhrases?.contract ?? '',
    strategy: existingPhrases?.strategy ?? '',
    edgeCase: existingPhrases?.edgeCase ?? '',
    test: existingPhrases?.test ?? '',
    markedAsExplained: existingPhrases?.markedAsExplained ?? false,
  });

  const handleSave = useCallback(() => {
    onUpdateProgress({ type: 'oralPhrases', subjectId: subject.id, phrases });
  }, [onUpdateProgress, subject.id, phrases]);

  const handleReset = useCallback(() => {
    setPhrases({ contract: '', strategy: '', edgeCase: '', test: '', markedAsExplained: false });
  }, []);

  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Algorithme verbal — étape par étape</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2">
            {subject.verbalAlgorithm.map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-neutral-300">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-primary/15 text-brand-primary text-xs font-bold shrink-0">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Explique en 4 phrases</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: 'contract' as const, label: 'Contrat', placeholder: 'Cette fonction prend en entrée... et renvoie...' },
            { key: 'strategy' as const, label: 'Stratégie', placeholder: "Pour cela, je parcours..., j'accumule..., et je filtre/trie/groupe selon..." },
            { key: 'edgeCase' as const, label: 'Cas limite', placeholder: "J'ai pensé au cas où..., dans ce cas je renvoie..." },
            { key: 'test' as const, label: 'Test', placeholder: "Je l'ai testée avec... qui doit donner..., et c'est bien ce que j'obtiens." },
          ].map(({ key, label, placeholder }) => (
            <div key={key} className="space-y-1">
              <label className="text-xs font-medium text-neutral-400">{label}</label>
              <textarea
                className="w-full rounded-lg border border-white/15 bg-surface-elevated text-neutral-100 px-3 py-2 text-sm placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
                rows={2}
                placeholder={placeholder}
                value={phrases[key]}
                onChange={(e) =>
                  setPhrases((p) => ({ ...p, [key]: e.target.value }))
                }
              />
            </div>
          ))}

          <div className="flex gap-2">
            <Button variant="default" size="sm" onClick={handleSave}>
              <Save className="mr-1 h-3 w-3" />
              Sauvegarder
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw className="mr-1 h-3 w-3" />
              Réinitialiser
            </Button>
            <Button
              variant={phrases.markedAsExplained ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                const updated = { ...phrases, markedAsExplained: !phrases.markedAsExplained };
                setPhrases(updated);
                onUpdateProgress({ type: 'oralPhrases', subjectId: subject.id, phrases: updated });
              }}
            >
              <Check className="mr-1 h-3 w-3" />
              Je sais l&apos;expliquer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CodeTab({ relatedPatterns }: { relatedPatterns: NsiPattern[] }) {
  const [revealLevels, setRevealLevels] = useState<Record<number, number>>({});

  const REVEAL_LABELS = [
    'Indice 1',
    'Indice 2',
    'Pseudo-code',
    'Solution complète',
  ];

  return (
    <div className="space-y-4 mt-4">
      {relatedPatterns.length === 0 && (
        <p className="text-sm text-neutral-500 text-center py-8">
          Aucun patron de code associé à ce sujet.
        </p>
      )}
      {relatedPatterns.map((pattern) => {
        const level = revealLevels[pattern.id] ?? 0;
        const lines = pattern.code.split('\n');
        const quarter = Math.ceil(lines.length / 4);

        let visibleCode = '';
        if (level >= 4) {
          visibleCode = pattern.code;
        } else if (level === 3) {
          visibleCode = lines
            .map((l) =>
              l.trim().startsWith('#') || l.trim().startsWith('def ') || l.trim() === ''
                ? l
                : '    # ...'
            )
            .join('\n');
        } else if (level === 2) {
          visibleCode = lines.slice(0, quarter * 2).join('\n') + '\n# ... (suite masquée)';
        } else if (level === 1) {
          visibleCode = lines.slice(0, quarter).join('\n') + '\n# ... (suite masquée)';
        }

        return (
          <Card key={pattern.id}>
            <CardHeader>
              <CardTitle className="text-sm">{pattern.title}</CardTitle>
              <p className="text-xs text-neutral-400">{pattern.whenToUse}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {level > 0 && <NsiCodeBlock code={visibleCode} />}

              <div className="flex flex-wrap gap-2">
                {REVEAL_LABELS.map((label, idx) => (
                  <Button
                    key={idx}
                    variant={level >= idx + 1 ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs"
                    onClick={() =>
                      setRevealLevels((prev) => ({
                        ...prev,
                        [pattern.id]: idx + 1,
                      }))
                    }
                  >
                    {level >= idx + 1 ? (
                      <Eye className="mr-1 h-3 w-3" />
                    ) : (
                      <EyeOff className="mr-1 h-3 w-3" />
                    )}
                    {label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function TrapsTab({ subject }: { subject: NsiSubject }) {
  const [understood, setUnderstood] = useState<Record<number, boolean>>({});

  return (
    <div className="space-y-3 mt-4">
      {subject.commonTraps.map((trap, i) => (
        <Card key={i}>
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="h-4 w-4 text-semantic-warning shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-neutral-200">{trap}</p>
            </div>
            <Button
              variant={understood[i] ? 'default' : 'outline'}
              size="sm"
              className="shrink-0 text-xs"
              onClick={() =>
                setUnderstood((prev) => ({ ...prev, [i]: !prev[i] }))
              }
            >
              <Check className="mr-1 h-3 w-3" />
              {understood[i] ? 'Compris' : "J'ai compris le piège"}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function OralTab({
  subject,
  progress,
  onUpdateProgress,
}: {
  subject: NsiSubject;
  progress: NsiProgress;
  onUpdateProgress: (update: Record<string, unknown>) => void;
}) {
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  return (
    <div className="space-y-3 mt-4">
      {subject.examinerQuestions.map((q, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium text-white">{q.question}</p>

            <AnimatePresence>
              {revealed[i] ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <p className="text-sm text-neutral-300 bg-surface-elevated rounded-lg p-3 border border-white/5">
                    {q.expectedAnswer}
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() =>
                  setRevealed((prev) => ({ ...prev, [i]: !prev[i] }))
                }
              >
                {revealed[i] ? (
                  <EyeOff className="mr-1 h-3 w-3" />
                ) : (
                  <Eye className="mr-1 h-3 w-3" />
                )}
                {revealed[i] ? 'Masquer' : 'Voir la réponse'}
              </Button>
              {revealed[i] && (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    className="text-xs"
                    onClick={() =>
                      onUpdateProgress({
                        type: 'flashcard',
                        cardId: `oral-${subject.id}-${i}`,
                        action: 'known',
                      })
                    }
                  >
                    <Check className="mr-1 h-3 w-3" />
                    Réponse maîtrisée
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() =>
                      onUpdateProgress({
                        type: 'flashcard',
                        cardId: `oral-${subject.id}-${i}`,
                        action: 'review',
                      })
                    }
                  >
                    À revoir
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TrainingTab({ subject }: { subject: NsiSubject }) {
  return (
    <div className="space-y-3 mt-4">
      {subject.trainingTasks.map((task, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Badge className={cn('text-[10px] border', TASK_TYPE_COLORS[task.type])}>
                {task.type}
              </Badge>
            </div>
            <p className="text-sm text-neutral-200">{task.prompt}</p>
            {task.expectedElements.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-neutral-500">Éléments attendus :</p>
                <ul className="space-y-0.5">
                  {task.expectedElements.map((el, j) => (
                    <li
                      key={j}
                      className="text-xs text-neutral-400 flex items-center gap-1.5"
                    >
                      <ChevronRight className="h-3 w-3 text-brand-primary" />
                      {el}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      {subject.trainingTasks.length === 0 && (
        <p className="text-center text-neutral-500 py-8 text-sm">
          Pas de tâches d&apos;entraînement pour ce sujet.
        </p>
      )}
    </div>
  );
}
