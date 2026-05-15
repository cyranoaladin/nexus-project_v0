'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Code2, Check, PenLine, BookOpen } from 'lucide-react';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { NsiCodeBlock } from './NsiCodeBlock';
import type {
  NsiPattern,
  NsiSubject,
  NsiProgress,
} from '@/data/nsi-pratique-2026/types';

interface NsiPatternLibraryProps {
  patterns: NsiPattern[];
  subjects: NsiSubject[];
  progress: NsiProgress;
  onUpdatePattern: (patternId: number, update: { mastered?: boolean; writtenByHand?: boolean }) => void;
}

export function NsiPatternLibrary({
  patterns,
  subjects,
  progress,
  onUpdatePattern,
}: NsiPatternLibraryProps) {
  const [view, setView] = useState<'grid' | 'accordion'>('grid');

  const getSubjectTitle = (id: number) =>
    subjects.find((s) => s.id === id)?.shortTitle ?? `Sujet ${id}`;

  if (view === 'accordion') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-4"
      >
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setView('grid')} className="text-xs">
            Vue grille
          </Button>
        </div>

        <Accordion type="multiple" className="space-y-2">
          {patterns.map((pattern) => {
            const patternProgress = progress.patterns[pattern.id];
            const isMastered = patternProgress?.mastered ?? false;
            const isWritten = patternProgress?.writtenByHand ?? false;

            return (
              <AccordionItem
                key={pattern.id}
                value={`pattern-${pattern.id}`}
                className="border border-white/10 rounded-xl bg-surface-card overflow-hidden"
              >
                <AccordionTrigger className="px-4 text-neutral-100 hover:no-underline">
                  <div className="flex items-center gap-2 min-w-0">
                    <Code2 className="h-4 w-4 text-brand-primary shrink-0" />
                    <span className="text-sm truncate">{pattern.title}</span>
                    {isMastered && (
                      <Check className="h-3.5 w-3.5 text-semantic-success shrink-0" />
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <PatternContent
                    pattern={pattern}
                    isMastered={isMastered}
                    isWritten={isWritten}
                    getSubjectTitle={getSubjectTitle}
                    onUpdatePattern={onUpdatePattern}
                  />
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setView('accordion')} className="text-xs">
          Vue accordéon
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {patterns.map((pattern, i) => {
          const patternProgress = progress.patterns[pattern.id];
          const isMastered = patternProgress?.mastered ?? false;
          const isWritten = patternProgress?.writtenByHand ?? false;

          return (
            <motion.div
              key={pattern.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.3 }}
            >
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Code2 className="h-4 w-4 text-brand-primary" />
                      {pattern.title}
                    </CardTitle>
                    {isMastered && (
                      <Badge variant="success" className="text-[10px]">
                        Maîtrisé
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400">{pattern.whenToUse}</p>
                </CardHeader>
                <CardContent className="pt-0">
                  <PatternContent
                    pattern={pattern}
                    isMastered={isMastered}
                    isWritten={isWritten}
                    getSubjectTitle={getSubjectTitle}
                    onUpdatePattern={onUpdatePattern}
                  />
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

function PatternContent({
  pattern,
  isMastered,
  isWritten,
  getSubjectTitle,
  onUpdatePattern,
}: {
  pattern: NsiPattern;
  isMastered: boolean;
  isWritten: boolean;
  getSubjectTitle: (id: number) => string;
  onUpdatePattern: (patternId: number, update: { mastered?: boolean; writtenByHand?: boolean }) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-400 italic">{pattern.mnemonic}</p>

      <NsiCodeBlock code={pattern.code} />

      {/* Related subjects */}
      <div className="flex flex-wrap gap-1">
        {pattern.relatedSubjects.map((id) => (
          <Badge key={id} variant="outline" className="text-[10px]">
            <BookOpen className="mr-0.5 h-2.5 w-2.5" />
            {getSubjectTitle(id)}
          </Badge>
        ))}
      </div>

      {/* Traps */}
      {pattern.traps.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-neutral-500">Pièges :</p>
          <ul className="space-y-0.5">
            {pattern.traps.map((t, j) => (
              <li key={j} className="text-xs text-neutral-400 flex items-start gap-1.5">
                <span className="text-semantic-warning">!</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-1">
        <Button
          variant={isMastered ? 'default' : 'outline'}
          size="sm"
          className="text-xs"
          onClick={() => onUpdatePattern(pattern.id, { mastered: !isMastered })}
        >
          <Check className="mr-1 h-3 w-3" />
          {isMastered ? 'Maîtrisé' : 'Marquer maîtrisé'}
        </Button>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={isWritten}
            onCheckedChange={(checked) =>
              onUpdatePattern(pattern.id, { writtenByHand: checked === true })
            }
          />
          <span className="text-xs text-neutral-300 flex items-center gap-1">
            <PenLine className="h-3 w-3" />
            Écrit à la main
          </span>
        </label>
      </div>
    </div>
  );
}
