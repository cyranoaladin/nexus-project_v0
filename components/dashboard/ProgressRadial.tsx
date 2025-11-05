interface ProgressRadialProps {
  value: number;
  label: string;
  caption?: string;
}

// Lightweight placeholder for future radial progress chart implementation.
export function ProgressRadial({ value, label, caption }: ProgressRadialProps) {
  const clamped = Math.min(Math.max(value, 0), 1);
  const percent = Math.round(clamped * 100);
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
      <span className="text-sm font-medium text-slate-500">{label}</span>
      <div className="relative flex h-24 w-24 items-center justify-center">
        <svg viewBox="0 0 36 36" className="h-24 w-24">
          <path
            className="stroke-slate-200"
            fill="none"
            strokeWidth="3"
            d="M18 2.0845
              a 15.9155 15.9155 0 0 1 0 31.831
              a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <path
            className="stroke-emerald-500"
            fill="none"
            strokeLinecap="round"
            strokeWidth="3"
            strokeDasharray={`${percent}, 100`}
            d="M18 2.0845
              a 15.9155 15.9155 0 0 1 0 31.831
              a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
        <span className="absolute text-xl font-semibold text-slate-900">
          {percent}%
        </span>
      </div>
      {caption ? (
        <p className="text-sm text-slate-500">{caption}</p>
      ) : null}
    </div>
  );
}
