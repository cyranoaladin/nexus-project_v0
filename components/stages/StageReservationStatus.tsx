'use client';

interface StageReservationStatusProps {
  status: string | null | undefined;
  className?: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING:    { label: 'En attente',       className: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
  CONFIRMED:  { label: 'Confirmée',        className: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
  WAITLISTED: { label: "Liste d'attente",  className: 'bg-blue-500/15 text-blue-400 border border-blue-500/30' },
  CANCELLED:  { label: 'Annulée',          className: 'bg-red-500/15 text-red-400 border border-red-500/30' },
  COMPLETED:  { label: 'Terminée',         className: 'bg-slate-500/15 text-slate-400 border border-slate-500/30' },
};

export function StageReservationStatus({ status, className = '' }: StageReservationStatusProps) {
  const cfg = STATUS_CONFIG[status ?? ''] ?? { label: status ?? '—', className: 'bg-slate-500/15 text-slate-400 border border-slate-500/30' };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.className} ${className}`}>
      {cfg.label}
    </span>
  );
}
