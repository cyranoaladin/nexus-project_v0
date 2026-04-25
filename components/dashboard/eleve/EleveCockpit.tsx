'use client';

import { AlertTriangle, Calendar, CheckCircle2, ClipboardList, Gauge, Info, MessageSquare, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { EleveDashboardData, EleveAlert, EleveAlertSeverity, EleveFeuilleDeRouteItem } from './types';

type EleveCockpitProps = {
  data: EleveDashboardData;
  onBookSession?: () => void;
  onOpenAria?: () => void;
  readOnly?: boolean;
};

const ALERT_STYLES: Record<EleveAlertSeverity, { icon: React.ElementType; className: string }> = {
  info:     { icon: Info,          className: 'border-blue-500/20 bg-blue-500/10 text-blue-200' },
  warning:  { icon: AlertTriangle, className: 'border-amber-500/20 bg-amber-500/10 text-amber-200' },
  critical: { icon: XCircle,       className: 'border-rose-500/20 bg-rose-500/10 text-rose-200' },
};

function AlertItem({ alert }: { alert: EleveAlert }) {
  const { icon: Icon, className } = ALERT_STYLES[alert.severity];
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-lg border p-3 ${className}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{alert.title}</p>
        <p className="text-xs opacity-80">{alert.body}</p>
        {alert.actionLabel && alert.actionHref && (
          <a href={alert.actionHref} className="mt-1 inline-block text-xs font-medium underline hover:opacity-80">
            {alert.actionLabel}
          </a>
        )}
      </div>
    </div>
  );
}

function RouteItem({ item }: { item: EleveFeuilleDeRouteItem }) {
  return (
    <a
      href={item.href}
      className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
        item.done
          ? 'border-white/5 bg-white/5 opacity-60'
          : 'border-white/10 bg-white/5 hover:border-brand-accent/40 hover:bg-brand-accent/5'
      }`}
      aria-label={`${item.title}${item.done ? ' (terminé)' : ''} · ${item.estimatedMinutes} min`}
    >
      <CheckCircle2
        className={`h-4 w-4 shrink-0 ${item.done ? 'text-emerald-400' : 'text-neutral-600'}`}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className={`truncate text-sm font-medium ${item.done ? 'line-through text-neutral-400' : 'text-neutral-100'}`}>
          {item.title}
        </p>
      </div>
      <span className="shrink-0 text-[10px] text-neutral-500">{item.estimatedMinutes} min</span>
    </a>
  );
}

export function EleveCockpit({ data, onBookSession, onOpenAria, readOnly = false }: EleveCockpitProps) {
  const nextSession = data.nextSession;
  const { feuilleDeRoute, alertes } = data.cockpit;

  return (
    <section id="cockpit" aria-labelledby="eleve-cockpit-title" className="space-y-4">
      <div>
        <h2 id="eleve-cockpit-title" className="text-xl font-semibold text-neutral-100">
          Cockpit du jour
        </h2>
        <p className="text-sm text-neutral-400">
          {data.student.gradeLevel ?? data.student.grade} · {data.student.academicTrack ?? 'EDS_GENERALE'}
        </p>
      </div>

      {/* Alertes */}
      {alertes.length > 0 && (
        <div className="space-y-2" aria-label="Alertes">
          {alertes.map((a) => (
            <AlertItem key={a.id} alert={a} />
          ))}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-white/10 bg-surface-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-neutral-200">
              <Calendar className="h-4 w-4 text-brand-accent" aria-hidden="true" />
              Prochaine séance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {nextSession ? (
              <>
                <p className="font-medium text-white">{nextSession.title}</p>
                <p className="text-sm text-neutral-400">
                  {new Date(nextSession.scheduledAt).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-neutral-400">Aucune séance programmée.</p>
                {!readOnly && (
                  <Button size="sm" onClick={onBookSession} className="btn-primary">
                    Réserver
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-surface-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-neutral-200">
              <Gauge className="h-4 w-4 text-brand-accent" aria-hidden="true" />
              Activité
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-white">{data.sessionsCount ?? data.recentSessions.length}</p>
            <p className="text-sm text-neutral-400">sessions suivies ou programmées</p>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-surface-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-neutral-200">
              <MessageSquare className="h-4 w-4 text-brand-accent" aria-hidden="true" />
              ARIA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-semibold text-white">{data.ariaStats.totalConversations}</p>
            <p className="text-sm text-neutral-400">conversations pédagogiques</p>
            {!readOnly && (
              <Button size="sm" variant="outline" onClick={onOpenAria} className="border-brand-accent/30 text-brand-accent">
                Ouvrir ARIA
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Feuille de route */}
      {feuilleDeRoute.length > 0 && (
        <Card className="border-white/10 bg-surface-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-neutral-200">
              <ClipboardList className="h-4 w-4 text-brand-accent" aria-hidden="true" />
              Feuille de route
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2" role="list" aria-label="Actions à réaliser">
              {feuilleDeRoute.map((item) => (
                <li key={item.id}>
                  <RouteItem item={item} />
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
