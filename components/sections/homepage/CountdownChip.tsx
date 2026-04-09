"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type CountdownChipProps = {
  targetDate: Date;
  label: string;
  tone: "stage" | "eaf" | "urgent";
};

const DAY_MS = 24 * 60 * 60 * 1000;

function getRemainingDays(targetDate: Date, now: Date) {
  const diff = targetDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / DAY_MS));
}

export default function CountdownChip({
  targetDate,
  label,
  tone,
}: CountdownChipProps) {
  const [days, setDays] = useState(() => getRemainingDays(targetDate, new Date()));

  useEffect(() => {
    const refresh = () => setDays(getRemainingDays(targetDate, new Date()));

    refresh();
    const intervalId = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(intervalId);
  }, [targetDate]);

  const toneClasses = useMemo(() => {
    switch (tone) {
      case "urgent":
        return "border-nexus-red/35 bg-nexus-red/10 text-nexus-red";
      case "eaf":
        return "border-nexus-purple/35 bg-nexus-purple/10 text-nexus-purple";
      case "stage":
      default:
        return "border-nexus-green/35 bg-nexus-green/10 text-nexus-green";
    }
  }, [tone]);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-mono font-medium uppercase tracking-[0.12em]",
        toneClasses
      )}
    >
      ⏱ J-{days} {label}
    </span>
  );
}
