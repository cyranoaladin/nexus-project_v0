/**
 * MetricCard — Reusable KPI card for dashboard displays.
 */

'use client';

import { type ReactNode } from 'react';

interface MetricCardProps {
  /** Card title */
  title: string;
  /** Main value to display */
  value: string | number;
  /** Optional subtitle or description */
  subtitle?: string;
  /** Optional icon */
  icon?: ReactNode;
  /** Optional trend indicator */
  trend?: 'up' | 'down' | 'stable';
  /** Optional trend value (e.g. "+8.4") */
  trendValue?: string;
  /** Color variant */
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}

const VARIANT_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  default:  { bg: 'from-slate-700/20 to-slate-700/5', border: 'border-slate-700', text: 'text-slate-200' },
  primary:  { bg: 'from-blue-500/20 to-blue-500/5', border: 'border-blue-500/30', text: 'text-blue-400' },
  success:  { bg: 'from-emerald-500/20 to-emerald-500/5', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  warning:  { bg: 'from-amber-500/20 to-amber-500/5', border: 'border-amber-500/30', text: 'text-amber-400' },
  danger:   { bg: 'from-red-500/20 to-red-500/5', border: 'border-red-500/30', text: 'text-red-400' },
};

const TREND_ICONS: Record<string, string> = {
  up: '↑',
  down: '↓',
  stable: '→',
};

const TREND_COLORS: Record<string, string> = {
  up: 'text-emerald-400',
  down: 'text-red-400',
  stable: 'text-slate-400',
};

export default function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
  variant = 'default',
}: MetricCardProps) {
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.default;

  return (
    <div className={`p-5 bg-gradient-to-br ${styles.bg} rounded-xl border ${styles.border}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-slate-400 mb-1">{title}</div>
          <div className={`text-3xl font-bold ${styles.text}`}>{value}</div>
          {subtitle && (
            <div className="text-xs text-slate-500 mt-1">{subtitle}</div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {icon && <div className="text-slate-400">{icon}</div>}
          {trend && (
            <div className={`flex items-center gap-1 text-sm font-medium ${TREND_COLORS[trend]}`}>
              <span>{TREND_ICONS[trend]}</span>
              {trendValue && <span>{trendValue}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
