import Link from "next/link";
import { ArrowRight, Check, Info, Lock, Sparkles } from "lucide-react";

type StageModule = {
  title: string;
  description: string;
};

type StageCardProps = {
  status: string;
  squad: string;
  title: string;
  subtitle: string;
  currentPrice: string;
  standardPrice: string;
  savings: string;
  tagline: string;
  modules: StageModule[];
  footer: string;
  ctaLabel: string;
  ctaHref: string;
};

export function StageCard({
  status,
  squad,
  title,
  subtitle,
  currentPrice,
  standardPrice,
  savings,
  tagline,
  modules,
  footer,
  ctaLabel,
  ctaHref,
}: StageCardProps) {
  return (
    <article className="relative overflow-hidden rounded-3xl border border-blue-300/20 bg-slate-900/70 p-6 shadow-[0_0_0_1px_rgba(147,197,253,0.16),0_18px_70px_-20px_rgba(37,99,235,0.65)] backdrop-blur-xl md:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.24),transparent_48%),radial-gradient(circle_at_bottom_left,rgba(30,64,175,0.16),transparent_42%)]" />

      <div className="relative space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-400/40 bg-slate-500/15 px-3 py-1 text-xs font-semibold text-slate-200">
            <Lock className="h-3.5 w-3.5" />
            {status}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-600 bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-200">
            <Info className="h-3.5 w-3.5" />
            {squad}
          </span>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-300">{subtitle}</p>
          <h2 className="mt-1 text-2xl font-extrabold text-white md:text-3xl">{title}</h2>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="text-4xl font-black leading-none text-white md:text-5xl">{currentPrice}</div>
          <div className="pb-1 text-lg font-medium text-slate-300 line-through">{standardPrice}</div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200">
            <Sparkles className="h-3.5 w-3.5" />
            {savings}
          </span>
        </div>

        <p className="text-base leading-relaxed text-slate-200">{tagline}</p>

        <ul className="space-y-3 text-sm text-slate-100 md:text-base">
          {modules.map((module) => (
            <li key={module.title} className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-200">
                <Check className="h-3.5 w-3.5" />
              </span>
              <p>
                <span className="font-semibold text-white">{module.title}</span>{" "}
                <span className="text-slate-300">{module.description}</span>
              </p>
            </li>
          ))}
        </ul>

        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/70 p-4 text-sm text-slate-300">
          {footer}
        </div>

        <Link
          href={ctaHref}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold tracking-wide text-white transition hover:bg-blue-500 md:w-auto"
        >
          {ctaLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}
