'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Check,
  HelpCircle,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type {
  NsiSubject,
  NsiPattern,
  OralQuestion,
  NsiProgress,
} from '@/data/nsi-pratique-2026/types';

interface NsiFlashcardsProps {
  subjects: NsiSubject[];
  patterns: NsiPattern[];
  oralQuestions: OralQuestion[];
  progress: NsiProgress;
  onUpdateFlashcard: (cardId: string, level: number) => void;
}

interface FlashcardItem {
  id: string;
  front: string;
  back: string;
  category: string;
}

type SourceType = 'all' | 'mnemonics' | 'oral' | 'traps' | 'patterns';

function buildDeck(
  source: SourceType,
  subjects: NsiSubject[],
  patterns: NsiPattern[],
  oralQuestions: OralQuestion[]
): FlashcardItem[] {
  const cards: FlashcardItem[] = [];

  if (source === 'all' || source === 'mnemonics') {
    for (const s of subjects) {
      cards.push({
        id: `mnemonic-${s.id}`,
        front: `Sujet ${s.id} — ${s.shortTitle}\nQuel est le mnémonique ?`,
        back: s.mnemonic,
        category: 'Mnémonique',
      });
    }
  }

  if (source === 'all' || source === 'oral') {
    for (const q of oralQuestions) {
      cards.push({
        id: `oral-${q.id}`,
        front: q.question,
        back: q.answer,
        category: 'Oral',
      });
    }
  }

  if (source === 'all' || source === 'traps') {
    for (const s of subjects) {
      for (let i = 0; i < s.commonTraps.length; i++) {
        cards.push({
          id: `trap-${s.id}-${i}`,
          front: `Sujet ${s.id} — Quel est le piège n°${i + 1} ?`,
          back: s.commonTraps[i],
          category: 'Piège',
        });
      }
    }
  }

  if (source === 'all' || source === 'patterns') {
    for (const p of patterns) {
      cards.push({
        id: `pattern-${p.id}`,
        front: `Patron : ${p.title}\nQuand l'utiliser ?`,
        back: p.whenToUse + '\n\nMnémonique : ' + p.mnemonic,
        category: 'Patron',
      });
    }
  }

  return cards;
}

export function NsiFlashcards({
  subjects,
  patterns,
  oralQuestions,
  progress,
  onUpdateFlashcard,
}: NsiFlashcardsProps) {
  const prefersReducedMotion = useReducedMotion();
  const [source, setSource] = useState<SourceType>('all');
  const [flipped, setFlipped] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const allCards = useMemo(
    () => buildDeck(source, subjects, patterns, oralQuestions),
    [source, subjects, patterns, oralQuestions]
  );

  // Sort by Leitner level (lower first)
  const sortedCards = useMemo(() => {
    return [...allCards].sort((a, b) => {
      const levelA = progress.flashcards[a.id]?.level ?? 0;
      const levelB = progress.flashcards[b.id]?.level ?? 0;
      return levelA - levelB;
    });
  }, [allCards, progress]);

  const currentCard = sortedCards[currentIndex];

  const levelCounts = useMemo(() => {
    const counts = [0, 0, 0, 0, 0]; // levels 0-4
    for (const card of sortedCards) {
      const level = Math.min(4, progress.flashcards[card.id]?.level ?? 0);
      counts[level]++;
    }
    return counts;
  }, [sortedCards, progress]);

  const handleAnswer = useCallback(
    (action: 'known' | 'review' | 'unknown') => {
      if (!currentCard) return;

      const current = progress.flashcards[currentCard.id]?.level ?? 0;
      let newLevel: number;

      if (action === 'known') {
        newLevel = Math.min(4, current + 1);
      } else if (action === 'unknown') {
        newLevel = 0;
      } else {
        newLevel = current; // stays
      }

      onUpdateFlashcard(currentCard.id, newLevel);
      setFlipped(false);

      // Move to next card
      if (currentIndex < sortedCards.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else {
        setCurrentIndex(0);
      }
    },
    [currentCard, currentIndex, sortedCards.length, progress, onUpdateFlashcard]
  );

  const handleSourceChange = useCallback((val: string) => {
    setSource(val as SourceType);
    setCurrentIndex(0);
    setFlipped(false);
  }, []);

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <Select value={source} onValueChange={handleSourceChange}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les cartes</SelectItem>
            <SelectItem value="mnemonics">Mnémoniques</SelectItem>
            <SelectItem value="oral">Questions d&apos;oral</SelectItem>
            <SelectItem value="traps">Pièges</SelectItem>
            <SelectItem value="patterns">Patrons de code</SelectItem>
          </SelectContent>
        </Select>

        <div className="text-xs text-neutral-400">
          {currentIndex + 1} / {sortedCards.length} cartes
        </div>
      </div>

      {/* Level distribution */}
      <div className="flex gap-2">
        {levelCounts.map((count, level) => (
          <div key={level} className="flex-1 text-center">
            <div
              className={cn(
                'rounded-lg border border-white/10 p-2',
                level === 0 && 'bg-red-500/10',
                level === 1 && 'bg-amber-500/10',
                level === 2 && 'bg-blue-500/10',
                level === 3 && 'bg-cyan-500/10',
                level === 4 && 'bg-emerald-500/10'
              )}
            >
              <p className="text-lg font-bold text-white">{count}</p>
              <p className="text-[10px] text-neutral-400">Niv. {level}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Card */}
      {currentCard ? (
        <div className="flex flex-col items-center gap-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentCard.id + (flipped ? '-back' : '-front')}
              initial={prefersReducedMotion ? false : { opacity: 0, rotateY: flipped ? -90 : 90 }}
              animate={{ opacity: 1, rotateY: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-lg cursor-pointer"
              onClick={() => setFlipped(!flipped)}
            >
              <Card className="min-h-[200px] flex flex-col justify-center">
                <CardContent className="p-6 text-center">
                  <Badge variant="outline" className="mb-3 text-[10px]">
                    {currentCard.category}
                  </Badge>
                  <p className="text-sm text-neutral-200 whitespace-pre-line">
                    {flipped ? currentCard.back : currentCard.front}
                  </p>
                  {!flipped && (
                    <p className="mt-4 text-[10px] text-neutral-500">
                      Cliquez pour retourner la carte
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>

          {/* Answer buttons */}
          {flipped && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3"
            >
              <Button
                variant="default"
                className="bg-semantic-success hover:bg-semantic-success/80 text-white"
                onClick={() => handleAnswer('known')}
              >
                <Check className="mr-1 h-4 w-4" />
                Je savais
              </Button>
              <Button
                variant="outline"
                className="border-semantic-warning text-semantic-warning hover:bg-semantic-warning/10"
                onClick={() => handleAnswer('review')}
              >
                <HelpCircle className="mr-1 h-4 w-4" />
                À revoir
              </Button>
              <Button
                variant="outline"
                className="border-semantic-error text-semantic-error hover:bg-semantic-error/10"
                onClick={() => handleAnswer('unknown')}
              >
                <X className="mr-1 h-4 w-4" />
                Je ne savais pas
              </Button>
            </motion.div>
          )}
        </div>
      ) : (
        <p className="text-center text-neutral-500 py-12">
          Aucune carte disponible pour cette source.
        </p>
      )}
    </motion.div>
  );
}
