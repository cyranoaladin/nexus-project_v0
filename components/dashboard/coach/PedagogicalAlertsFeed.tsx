"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, TrendingDown, CalendarX, Clock } from "lucide-react";

export interface PedagogicalAlert {
  id: string;
  type: "NEXUS_INDEX_DROP" | "NO_SHOW" | "INACTIVITY" | "EXERCISE_STREAK_FAIL";
  severity: "HIGH" | "MEDIUM" | "LOW";
  message: string;
  detectedAt: string | Date;
}

interface PedagogicalAlertsFeedProps {
  alerts: PedagogicalAlert[];
  className?: string;
}

const TYPE_META: Record<PedagogicalAlert["type"], { icon: typeof AlertTriangle; label: string }> = {
  NEXUS_INDEX_DROP: { icon: TrendingDown, label: "NexusIndex en chute" },
  NO_SHOW: { icon: CalendarX, label: "No-show récurrent" },
  INACTIVITY: { icon: Clock, label: "Inactivité prolongée" },
  EXERCISE_STREAK_FAIL: { icon: AlertTriangle, label: "Exercices ratés en cluster" },
};

const SEVERITY_CLASS: Record<PedagogicalAlert["severity"], string> = {
  HIGH: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  MEDIUM: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  LOW: "bg-sky-500/10 text-sky-400 border-sky-500/30",
};

/**
 * Phase 6 — Affiche les alertes pédagogiques **d'un élève** (à utiliser
 * dans le dossier coach, contrairement à `PriorityAlerts` qui est
 * cross-cohorte sur le dashboard principal).
 */
export function PedagogicalAlertsFeed({ alerts, className }: PedagogicalAlertsFeedProps) {
  return (
    <Card className={`bg-surface-card border-white/10 shadow-premium ${className ?? ""}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-base flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          Alertes pédagogiques
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <p className="text-xs text-neutral-500 italic">Aucune alerte active.</p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((alert) => {
              const meta = TYPE_META[alert.type];
              const Icon = meta.icon;
              const detected =
                typeof alert.detectedAt === "string"
                  ? new Date(alert.detectedAt)
                  : alert.detectedAt;
              return (
                <li
                  key={alert.id}
                  className={`p-3 rounded-lg border text-xs flex items-start gap-3 ${SEVERITY_CLASS[alert.severity]}`}
                >
                  <Icon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="font-bold uppercase text-[10px] tracking-wide mb-0.5">
                      {meta.label}
                    </p>
                    <p className="text-neutral-200">{alert.message}</p>
                    <p className="text-[10px] text-neutral-500 mt-1">
                      {detected.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
