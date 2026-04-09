import { TRUST_COMMITMENTS, TRUST_METRICS } from "@/components/sections/homepage/content";
import { resolveUiIcon } from "@/lib/ui-icons";

export default function TrustSection() {
  return (
    <section className="bg-nexus-bg px-6 py-20 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <h2 className="font-display text-h2 font-bold text-white">
            Pourquoi plusieurs centaines d'élèves nous font confiance
          </h2>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {TRUST_METRICS.map((metric) => (
            <div key={metric.label} className="rounded-[22px] border border-white/6 bg-white/[0.025] p-6">
              <div className="font-display text-4xl font-bold text-nexus-green">{metric.value}</div>
              <div className="mt-2 text-xs uppercase tracking-[0.14em] text-white/45">
                {metric.label}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {TRUST_COMMITMENTS.map((item) => (
            <article key={item.title} className="rounded-[22px] border border-white/6 bg-white/[0.02] p-6">
              {(() => {
                const CommitmentIcon = resolveUiIcon(item.icon);
                return (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-nexus-green">
                <CommitmentIcon className="h-5 w-5" aria-hidden="true" />
              </div>
                );
              })()}
              <h3 className="mt-4 font-display text-xl font-bold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-white/55">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
