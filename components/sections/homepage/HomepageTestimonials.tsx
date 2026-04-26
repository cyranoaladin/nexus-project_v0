import { TESTIMONIALS } from "@/components/sections/homepage/content";
import { Quote, Star } from "lucide-react";

function tagClass(tag: string) {
  if (tag.includes("Stage")) {
    return "bg-[#fff1f2] text-[#9f1239]";
  }

  return "bg-[#eff6ff] text-[#0f3d73]";
}

export default function HomepageTestimonials() {
  return (
    <section className="bg-[#f7fbff] px-6 py-20 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#0f3d73]">
            Preuves et retours
          </p>
          <h2 className="mt-4 font-display text-h2 font-bold text-[#0f2f57]">
            Des retours sobres sur la méthode, le cadre et la progression.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-700">
            Les témoignages restent centrés sur ce qui compte pour les familles : régularité, confiance, visibilité et préparation des échéances.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {TESTIMONIALS.map((testimonial) => (
            <article key={testimonial.name} className="flex h-full flex-col rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mt-4 flex items-center gap-1 text-[#ca8a04]">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star key={index} className="h-4 w-4 fill-current" aria-hidden="true" />
                ))}
              </div>
              <p className="mt-4 flex-1 text-sm italic leading-7 text-slate-700">
                <Quote className="mr-2 inline h-4 w-4 text-slate-400" aria-hidden="true" />
                « {testimonial.quote} »
              </p>
              <div className="mt-6">
                <h3 className="font-display text-lg font-bold text-slate-950">{testimonial.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{testimonial.school}</p>
                <p className="mt-1 text-sm text-slate-700">{testimonial.result}</p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {testimonial.tags.map((tag) => (
                  <span key={tag} className={`rounded-full px-3 py-1 text-xs ${tagClass(tag)}`}>
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
