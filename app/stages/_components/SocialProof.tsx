import { Quote, Star } from "lucide-react";

import { TESTIMONIALS } from "../_data/packs";

export default function SocialProof() {
  return (
    <section className="bg-nexus-bg px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/42">
            Ils l'ont vécu. Ils le recommandent.
          </p>
          <h2 className="mt-3 font-display text-h2 font-bold text-white">
            Des résultats qui changent la manière d'aborder l'examen.
          </h2>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {TESTIMONIALS.map((testimonial) => (
            <article
              key={`${testimonial.name}-${testimonial.role}`}
              className="rounded-[24px] border border-white/8 bg-white/[0.03] p-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-nexus-amber">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} className="h-4 w-4 fill-current" aria-hidden="true" />
                  ))}
                </div>
                <Quote className="h-4 w-4 text-white/35" aria-hidden="true" />
              </div>
              <p className="mt-4 text-sm italic leading-7 text-white/72">« {testimonial.quote} »</p>
              <div className="mt-6">
                <div className="font-display text-lg font-bold text-white">{testimonial.name}</div>
                <div className="text-sm text-white/45">{testimonial.role}</div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
