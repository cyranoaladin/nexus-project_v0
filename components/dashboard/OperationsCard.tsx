'use client';

import { useEffect, useState } from 'react';
import { Users, CreditCard, Calendar, Inbox } from 'lucide-react';

/**
 * OperationsCard — Replaces NexusIndexCard for assistante role.
 *
 * Shows operations-centric metrics: pending requests, payments,
 * today's sessions, active students.
 */

interface OperationsMetrics {
  pendingSubscriptions: number;
  pendingPayments: number;
  pendingCredits: number;
  todaySessions: number;
  totalStudents: number;
}

export function OperationsCard() {
  const [data, setData] = useState<OperationsMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchMetrics() {
      try {
        const res = await fetch('/api/assistant/dashboard');
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;

        setData({
          pendingSubscriptions: json.stats?.pendingSubscriptionRequests ?? 0,
          pendingPayments: json.stats?.pendingPayments ?? 0,
          pendingCredits: json.stats?.pendingCreditRequests ?? 0,
          todaySessions: json.todaySessions?.length ?? 0,
          totalStudents: json.stats?.totalStudents ?? 0,
        });
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchMetrics();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-surface-card p-6 animate-pulse">
        <div className="h-4 w-36 rounded bg-neutral-800 mb-4" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-neutral-800" />
          ))}
        </div>
      </div>
    );
  }

  const totalPending = (data?.pendingSubscriptions ?? 0) + (data?.pendingPayments ?? 0) + (data?.pendingCredits ?? 0);

  const metrics = [
    {
      icon: Inbox,
      label: 'Demandes en attente',
      value: totalPending,
      color: totalPending > 0 ? 'text-amber-400' : 'text-emerald-400',
    },
    {
      icon: CreditCard,
      label: 'Paiements à valider',
      value: data?.pendingPayments ?? 0,
      color: (data?.pendingPayments ?? 0) > 0 ? 'text-red-400' : 'text-neutral-400',
    },
    {
      icon: Calendar,
      label: 'Séances du jour',
      value: data?.todaySessions ?? 0,
      color: 'text-brand-accent',
    },
    {
      icon: Users,
      label: 'Élèves actifs',
      value: data?.totalStudents ?? 0,
      color: 'text-blue-400',
    },
  ];

  return (
    <div className="rounded-xl border border-neutral-800 bg-surface-card p-6">
      <h3 className="text-sm font-semibold text-neutral-200 mb-1">Vue opérationnelle</h3>
      <p className="text-[11px] text-neutral-500 mb-4">Flux en cours et actions à traiter.</p>
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="flex items-start gap-3 rounded-lg bg-surface-elevated p-3"
          >
            <metric.icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${metric.color}`} />
            <div className="min-w-0">
              <p className="text-lg font-semibold text-neutral-100 leading-tight">
                {metric.value}
              </p>
              <p className="text-[10px] text-neutral-500 mt-0.5">{metric.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
