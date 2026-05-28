"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock } from "lucide-react";
import { EXAM_DATE } from "./data";

function getRemaining(now: Date) {
  const diffMs = EXAM_DATE.getTime() - now.getTime();
  const safeDiff = Math.max(0, diffMs);
  const days = Math.floor(safeDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((safeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((safeDiff % (1000 * 60 * 60)) / (1000 * 60));
  return { diffMs, days, hours, minutes };
}

export function Countdown() {
  const [now, setNow] = useState(() => new Date());
  const remaining = getRemaining(now);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const status = useMemo(() => {
    if (remaining.diffMs < 0) return { label: "Épreuve terminée", tone: "text-neutral-400 border-white/10 bg-white/5" };
    if (remaining.days === 0) return { label: "Aujourd'hui à 08h00", tone: "text-emerald-200 border-emerald-400/30 bg-emerald-500/10 animate-pulse" };
    if (remaining.days === 1) return { label: "Demain", tone: "text-rose-200 border-rose-400/30 bg-rose-500/10" };
    if (remaining.days <= 3) return { label: `J-${remaining.days} - ${remaining.hours}h ${remaining.minutes}min`, tone: "text-orange-200 border-orange-400/30 bg-orange-500/10" };
    return { label: `J-${remaining.days}`, tone: "text-brand-accent border-brand-accent/30 bg-brand-accent/10" };
  }, [remaining.days, remaining.diffMs, remaining.hours, remaining.minutes]);

  const relativeFormatter = useMemo(() => new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" }), []);

  return (
    <div className={`rounded-xl border px-4 py-3 ${status.tone}`} aria-label={relativeFormatter.format(remaining.days, "day")}>
      <div className="flex items-center gap-3">
        <Clock className="h-5 w-5" aria-hidden="true" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider">8 juin 2026 — 08h00, heure de Paris</p>
          <p className="text-2xl font-black leading-tight">{status.label}</p>
        </div>
      </div>
    </div>
  );
}
