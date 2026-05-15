'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Save, RotateCcw, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import type {
  NsiSubject,
  NsiProgress,
  OralFourPhrases,
} from '@/data/nsi-pratique-2026/types';

interface NsiOralTrainerProps {
  subjects: NsiSubject[];
  progress: NsiProgress;
  onUpdateOralPhrases: (subjectId: number, phrases: OralFourPhrases) => void;
}

const FIELDS: {
  key: keyof Omit<OralFourPhrases, 'markedAsExplained'>;
  label: string;
  placeholder: string;
  number: number;
}[] = [
  {
    key: 'contract',
    label: 'Contrat',
    number: 1,
    placeholder: 'Cette fonction prend en entrée... et renvoie...',
  },
  {
    key: 'strategy',
    label: 'Stratégie',
    number: 2,
    placeholder:
      "Pour cela, je parcours..., j'accumule..., et je filtre/trie/groupe selon...",
  },
  {
    key: 'edgeCase',
    label: 'Cas limite',
    number: 3,
    placeholder: "J'ai pensé au cas où..., dans ce cas je renvoie...",
  },
  {
    key: 'test',
    label: 'Test',
    number: 4,
    placeholder:
      "Je l'ai testée avec... qui doit donner..., et c'est bien ce que j'obtiens.",
  },
];

function getDefaultPhrases(): OralFourPhrases {
  return {
    contract: '',
    strategy: '',
    edgeCase: '',
    test: '',
    markedAsExplained: false,
  };
}

export function NsiOralTrainer({
  subjects,
  progress,
  onUpdateOralPhrases,
}: NsiOralTrainerProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const selectedSubject = useMemo(
    () => subjects.find((s) => s.id === selectedId) ?? null,
    [subjects, selectedId]
  );

  const existingPhrases = selectedId
    ? progress.oralPhrases[selectedId]
    : undefined;

  const [phrases, setPhrases] = useState<OralFourPhrases>(
    existingPhrases ?? getDefaultPhrases()
  );

  const handleSelectSubject = useCallback(
    (val: string) => {
      const id = parseInt(val, 10);
      setSelectedId(id);
      setPhrases(progress.oralPhrases[id] ?? getDefaultPhrases());
    },
    [progress.oralPhrases]
  );

  const handleSave = useCallback(() => {
    if (selectedId === null) return;
    onUpdateOralPhrases(selectedId, phrases);
  }, [selectedId, phrases, onUpdateOralPhrases]);

  const handleReset = useCallback(() => {
    setPhrases(getDefaultPhrases());
  }, []);

  const handleMarkExplained = useCallback(() => {
    if (selectedId === null) return;
    const updated = { ...phrases, markedAsExplained: !phrases.markedAsExplained };
    setPhrases(updated);
    onUpdateOralPhrases(selectedId, updated);
  }, [selectedId, phrases, onUpdateOralPhrases]);

  // Stats: how many subjects have been explained
  const explainedCount = useMemo(
    () =>
      Object.values(progress.oralPhrases).filter((p) => p.markedAsExplained)
        .length,
    [progress.oralPhrases]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-brand-primary" />
          <h3 className="text-lg font-semibold text-white">Oral en 4 phrases</h3>
        </div>
        <Badge variant="outline" className="text-xs">
          {explainedCount} / {subjects.length} sujets expliqués
        </Badge>
      </div>

      {/* Subject selector */}
      <Select
        value={selectedId?.toString() ?? ''}
        onValueChange={handleSelectSubject}
      >
        <SelectTrigger>
          <SelectValue placeholder="Choisir un sujet..." />
        </SelectTrigger>
        <SelectContent>
          {subjects.map((s) => (
            <SelectItem key={s.id} value={s.id.toString()}>
              <span className="flex items-center gap-2">
                <span className="text-neutral-500 font-mono">#{s.id}</span>
                <span>{s.shortTitle}</span>
                {progress.oralPhrases[s.id]?.markedAsExplained && (
                  <Check className="h-3 w-3 text-semantic-success" />
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Phrases form */}
      {selectedSubject && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              #{selectedSubject.id} — {selectedSubject.title}
            </CardTitle>
            {phrases.markedAsExplained && (
              <Badge variant="success" className="w-fit text-xs">
                <Check className="mr-1 h-3 w-3" />
                Expliqué
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {FIELDS.map(({ key, label, placeholder, number }) => (
              <div key={key} className="space-y-1">
                <label className="text-xs font-medium text-neutral-400">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-primary/15 text-brand-primary text-[10px] font-bold mr-1.5">
                    {number}
                  </span>
                  {label}
                </label>
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

            <div className="flex flex-wrap gap-2 pt-2">
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
                onClick={handleMarkExplained}
              >
                <Check className="mr-1 h-3 w-3" />
                {phrases.markedAsExplained
                  ? 'Marqué comme expliqué'
                  : 'Marquer comme expliqué'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!selectedSubject && (
        <p className="text-center text-neutral-500 py-12 text-sm">
          Sélectionnez un sujet pour commencer l&apos;entraînement oral.
        </p>
      )}
    </motion.div>
  );
}
