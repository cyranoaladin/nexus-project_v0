"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type CountdownChipProps = {
  targetDate: string;
  label: string;
  tone?: "green" | "red" | "amber" | "purple";
  className?: string;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function getDaysRemaining(targetDate: string) {
  const delta = new Date(targetDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(delta / MS_PER_DAY));
}

const toneClasses: Record<NonNullable<CountdownChipProps["tone"]>, string> = {
  green: "border-nexus-green/30 bg-nexus-green/10 text-nexus-green",
  red: "border-nexus-red/30 bg-nexus-red/10 text-nexus-red",
  amber: "border-nexus-amber/30 bg-nexus-amber/10 text-nexus-amber",
  purple: "border-nexus-purple/30 bg-nexus-purple/10 text-nexus-purple",
};

export default function CountdownChip({
  targetDate,
  label,
  tone = "green",
  className,
}: CountdownChipProps) {
  const [days, setDays] = useState(() => getDaysRemaining(targetDate));

  useEffect(() => {
    setDays(getDaysRemaining(targetDate));
    const id = window.setInterval(() => {
      setDays(getDaysRemaining(targetDate));
    }, 60_000);

    return () => window.clearInterval(id);
  }, [targetDate]);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]",
        toneClasses[tone],
        className
      )}
    >
      ⏱ J-{days} {label}
    </span>
  );
}
