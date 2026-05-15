'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Eye,
  EyeOff,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  OralQuestion,
  NsiProgress,
} from '@/data/nsi-pratique-2026/types';

interface NsiTransversalQuestionsProps {
  questions: OralQuestion[];
  progress: NsiProgress;
  onUpdateFlashcard: (cardId: string, level: number) => void;
}

export function NsiTransversalQuestions({
  questions,
  progress,
  onUpdateFlashcard,
}: NsiTransversalQuestionsProps) {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(questions.map((q) => q.category))),
    [questions]
  );

  const filtered = useMemo(() => {
    if (!filterCategory) return questions;
    return questions.filter((q) => q.category === filterCategory);
  }, [questions, filterCategory]);

  const getCardLevel = (id: string) =>
    progress.flashcards[`transversal-${id}`]?.level ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      {/* Header + filter */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-brand-primary" />
          <h3 className="text-lg font-semibold text-white">
            Questions transversales
          </h3>
        </div>
      </div>

      {/* Category badges */}
      <div className="flex flex-wrap gap-2">
        <Badge
          variant={filterCategory === null ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => setFilterCategory(null)}
        >
          Toutes
        </Badge>
        {categories.map((cat) => (
          <Badge
            key={cat}
            variant={filterCategory === cat ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() =>
              setFilterCategory(filterCategory === cat ? null : cat)
            }
          >
            {cat}
          </Badge>
        ))}
      </div>

      {/* Questions list */}
      <div className="space-y-3">
        {filtered.map((q, i) => {
          const isRevealed = revealed[q.id] ?? false;
          const level = getCardLevel(q.id);
          const isMastered = level >= 3;

          return (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 * i, duration: 0.3 }}
            >
              <Card
                className={cn(
                  isMastered && 'border-semantic-success/20'
                )}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {q.category}
                        </Badge>
                        {isMastered && (
                          <Badge variant="success" className="text-[10px]">
                            Maîtrisé
                          </Badge>
                        )}
                        {level > 0 && !isMastered && (
                          <span className="text-[10px] text-neutral-500">
                            Niveau {level}/4
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-white">
                        {q.question}
                      </p>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isRevealed && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="rounded-lg border border-white/5 bg-surface-elevated p-3 mt-1">
                          <p className="text-sm text-neutral-300">
                            {q.answer}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() =>
                        setRevealed((prev) => ({
                          ...prev,
                          [q.id]: !prev[q.id],
                        }))
                      }
                    >
                      {isRevealed ? (
                        <EyeOff className="mr-1 h-3 w-3" />
                      ) : (
                        <Eye className="mr-1 h-3 w-3" />
                      )}
                      {isRevealed ? 'Masquer' : 'Voir la réponse'}
                    </Button>

                    {isRevealed && (
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          className="text-xs bg-semantic-success hover:bg-semantic-success/80"
                          onClick={() =>
                            onUpdateFlashcard(
                              `transversal-${q.id}`,
                              Math.min(4, level + 1)
                            )
                          }
                        >
                          <Check className="mr-1 h-3 w-3" />
                          Maîtrisé
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs border-semantic-warning text-semantic-warning"
                          onClick={() =>
                            onUpdateFlashcard(`transversal-${q.id}`, 0)
                          }
                        >
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          À revoir
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-neutral-500 py-12 text-sm">
          Aucune question pour cette catégorie.
        </p>
      )}
    </motion.div>
  );
}
