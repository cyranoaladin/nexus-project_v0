'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  SelfAssessmentItem,
  NsiProgress,
  SelfAssessmentProgress,
} from '@/data/nsi-pratique-2026/types';

interface NsiSelfAssessmentProps {
  items: SelfAssessmentItem[];
  progress: NsiProgress;
  onUpdateAssessment: (
    itemId: string,
    update: Partial<SelfAssessmentProgress>
  ) => void;
}

export function NsiSelfAssessment({
  items,
  progress,
  onUpdateAssessment,
}: NsiSelfAssessmentProps) {
  const [localNotes, setLocalNotes] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const item of items) {
      initial[item.id] = progress.selfAssessment[item.id]?.note ?? '';
    }
    return initial;
  });

  const stats = useMemo(() => {
    let okCount = 0;
    let reviewCount = 0;
    let notAssessedCount = 0;

    for (const item of items) {
      const status = progress.selfAssessment[item.id]?.status ?? 'not_assessed';
      if (status === 'ok') okCount++;
      else if (status === 'needs_review') reviewCount++;
      else notAssessedCount++;
    }

    const score = items.length > 0 ? Math.round((okCount / items.length) * 100) : 0;

    let readiness: 'ready' | 'almost' | 'consolidate' = 'consolidate';
    if (okCount >= items.length * 0.8) readiness = 'ready';
    else if (okCount >= items.length * 0.5) readiness = 'almost';

    return { okCount, reviewCount, notAssessedCount, score, readiness };
  }, [items, progress]);

  const readinessConfig = {
    ready: {
      label: 'Prêt',
      color: 'text-semantic-success',
      bg: 'bg-semantic-success/10 border-semantic-success/30',
      icon: <ShieldCheck className="h-5 w-5" />,
    },
    almost: {
      label: 'Presque prêt',
      color: 'text-semantic-warning',
      bg: 'bg-semantic-warning/10 border-semantic-warning/30',
      icon: <AlertTriangle className="h-5 w-5" />,
    },
    consolidate: {
      label: 'À consolider',
      color: 'text-semantic-error',
      bg: 'bg-semantic-error/10 border-semantic-error/30',
      icon: <AlertTriangle className="h-5 w-5" />,
    },
  };

  const readinessInfo = readinessConfig[stats.readiness];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Readiness banner */}
      <Card
        className={cn('border', readinessInfo.bg)}
      >
        <CardContent className="flex items-center gap-4 p-4">
          <div className={readinessInfo.color}>{readinessInfo.icon}</div>
          <div className="flex-1">
            <p className={cn('text-lg font-bold', readinessInfo.color)}>
              {readinessInfo.label}
            </p>
            <p className="text-xs text-neutral-400">
              {stats.okCount} / {items.length} compétences validées — Score :{' '}
              {stats.score}%
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="success" className="text-xs">
              {stats.okCount} OK
            </Badge>
            <Badge variant="warning" className="text-xs">
              {stats.reviewCount} à revoir
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Assessment items */}
      <div className="space-y-3">
        {items.map((item, i) => {
          const assessment = progress.selfAssessment[item.id];
          const status = assessment?.status ?? 'not_assessed';

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 * i, duration: 0.3 }}
            >
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">
                        {item.label}
                      </p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {item.description}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant={status === 'ok' ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          'text-xs',
                          status === 'ok' &&
                            'bg-semantic-success hover:bg-semantic-success/80 border-semantic-success'
                        )}
                        onClick={() =>
                          onUpdateAssessment(item.id, {
                            status: status === 'ok' ? 'not_assessed' : 'ok',
                          })
                        }
                      >
                        <Check className="mr-1 h-3 w-3" />
                        OK
                      </Button>
                      <Button
                        variant={
                          status === 'needs_review' ? 'default' : 'outline'
                        }
                        size="sm"
                        className={cn(
                          'text-xs',
                          status === 'needs_review' &&
                            'bg-semantic-warning hover:bg-semantic-warning/80 border-semantic-warning text-white'
                        )}
                        onClick={() =>
                          onUpdateAssessment(item.id, {
                            status:
                              status === 'needs_review'
                                ? 'not_assessed'
                                : 'needs_review',
                          })
                        }
                      >
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        À revoir
                      </Button>
                    </div>
                  </div>

                  {/* Note field */}
                  <textarea
                    className="w-full rounded-lg border border-white/10 bg-surface-elevated text-neutral-100 px-3 py-2 text-xs placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
                    rows={1}
                    placeholder="Note libre..."
                    value={localNotes[item.id] ?? ''}
                    onChange={(e) =>
                      setLocalNotes((prev) => ({
                        ...prev,
                        [item.id]: e.target.value,
                      }))
                    }
                    onBlur={() =>
                      onUpdateAssessment(item.id, {
                        note: localNotes[item.id] || undefined,
                      })
                    }
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
