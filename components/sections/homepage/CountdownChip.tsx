"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3 } from "lucide-react";
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
        return "border-[#b91c1c]/30 bg-[#fff1f2] text-[#9f1239]";
      case "eaf":
        return "border-[#0f3d73]/25 bg-[#eff6ff] text-[#0f3d73]";
      case "stage":
      default:
        return "border-[#b91c1c]/25 bg-white text-[#9f1239]";
    }
  }, [tone]);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-mono font-medium uppercase tracking-[0.12em]",
        toneClasses
      )}
    >
      <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
      J-{days} {label}
    </span>
  );
}
