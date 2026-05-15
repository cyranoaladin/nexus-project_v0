'use client';

import { motion } from 'framer-motion';
import { Calendar, Sun, Sunset, Moon, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { FiveDay, NsiProgress } from '@/data/nsi-pratique-2026/types';

interface NsiFiveDayPlanProps {
  plan: FiveDay[];
  progress: NsiProgress;
  onToggleTask: (taskKey: string) => void;
}

const PERIOD_ICONS: Record<string, React.ReactNode> = {
  Matin: <Sun className="h-3.5 w-3.5 text-amber-400" />,
  'Après-midi': <Sunset className="h-3.5 w-3.5 text-orange-400" />,
  Soir: <Moon className="h-3.5 w-3.5 text-indigo-400" />,
};

const TASK_TYPE_COLORS: Record<string, string> = {
  new: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  review: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  timed: 'bg-red-500/15 text-red-300 border-red-500/30',
  oral: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  patterns: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  mnemonics: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  mock: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
  read: 'bg-neutral-500/15 text-neutral-300 border-neutral-500/30',
};

function getTaskKey(dayIndex: number, slotIndex: number, taskIndex: number) {
  return `day-${dayIndex}-slot-${slotIndex}-task-${taskIndex}`;
}

export function NsiFiveDayPlan({ plan, progress, onToggleTask }: NsiFiveDayPlanProps) {
  // Calculate totals
  let totalTasks = 0;
  let totalCompleted = 0;

  const dayStats = plan.map((day, di) => {
    let dayTasks = 0;
    let dayCompleted = 0;
    day.slots.forEach((slot, si) => {
      slot.tasks.forEach((_, ti) => {
        const key = getTaskKey(di, si, ti);
        dayTasks++;
        totalTasks++;
        if (progress.fiveDayPlan[key]?.completed) {
          dayCompleted++;
          totalCompleted++;
        }
      });
    });
    return { dayTasks, dayCompleted };
  });

  const overallPercent = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Overall progress */}
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <Calendar className="h-5 w-5 text-brand-primary shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">Progression globale du plan</span>
              <span className="text-sm text-neutral-400">{overallPercent}%</span>
            </div>
            <Progress value={overallPercent} />
          </div>
        </CardContent>
      </Card>

      {/* Days grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {plan.map((day, di) => {
          const { dayTasks, dayCompleted } = dayStats[di];
          const dayPercent = dayTasks > 0 ? Math.round((dayCompleted / dayTasks) * 100) : 0;

          return (
            <motion.div
              key={di}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * di, duration: 0.3 }}
            >
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">
                      {day.label}
                    </CardTitle>
                    {dayPercent === 100 && (
                      <Check className="h-4 w-4 text-semantic-success" />
                    )}
                  </div>
                  <p className="text-xs text-neutral-400">{day.theme}</p>
                  <Progress value={dayPercent} className="h-1.5 mt-1" />
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {day.slots.map((slot, si) => (
                    <div key={si} className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        {PERIOD_ICONS[slot.period] ?? null}
                        <span className="text-xs font-medium text-neutral-300">
                          {slot.period}
                        </span>
                        <span className="text-[10px] text-neutral-500">
                          ({slot.duration})
                        </span>
                      </div>
                      {slot.tasks.map((task, ti) => {
                        const key = getTaskKey(di, si, ti);
                        const isCompleted = progress.fiveDayPlan[key]?.completed ?? false;

                        return (
                          <label
                            key={ti}
                            className={cn(
                              'flex items-start gap-2 rounded-lg border border-white/5 bg-surface-elevated p-2 cursor-pointer transition-colors hover:border-white/15',
                              isCompleted && 'opacity-60'
                            )}
                          >
                            <Checkbox
                              checked={isCompleted}
                              onCheckedChange={() => onToggleTask(key)}
                              className="mt-0.5"
                            />
                            <div className="min-w-0">
                              <p
                                className={cn(
                                  'text-xs text-neutral-200',
                                  isCompleted && 'line-through text-neutral-500'
                                )}
                              >
                                {task.label}
                              </p>
                              <Badge
                                className={cn(
                                  'text-[9px] px-1 py-0 mt-1 border',
                                  TASK_TYPE_COLORS[task.type] ?? TASK_TYPE_COLORS.read
                                )}
                              >
                                {task.type}
                              </Badge>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
