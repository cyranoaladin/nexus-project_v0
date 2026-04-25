"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
}

export function Progress({ value = 0, className, ...props }: ProgressProps) {
  const boundedValue = Math.min(100, Math.max(0, value));

  return (
    <div
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-neutral-800", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={boundedValue}
      {...props}
    >
      <div
        className="h-full rounded-full bg-brand-accent transition-all"
        style={{ width: `${boundedValue}%` }}
      />
    </div>
  );
}
