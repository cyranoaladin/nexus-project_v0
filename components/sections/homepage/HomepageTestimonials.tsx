import { TESTIMONIALS } from "@/components/sections/homepage/content";

function tagClass(tag: string) {
  if (tag.includes("EAF")) {
    return "bg-nexus-purple/12 text-nexus-purple";
  }

  return "bg-nexus-green/12 text-nexus-green";
}

export default function HomepageTestimonials() {
  return (
    <section className="bg-nexus-bg-alt px-6 py-20 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/45">
            Témoignages
          </p>
          <h2 className="mt-4 font-display text-h2 font-bold text-white">
            Ils ont transformé leurs résultats
          </h2>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {TESTIMONIALS.map((testimonial) => (
            <article key={testimonial.name} className="flex h-full flex-col rounded-[24px] border border-white/8 bg-white/[0.025] p-6">
              <div className="text-nexus-amber">★★★★★</div>
              <p className="mt-4 flex-1 text-sm italic leading-7 text-white/70">
                « {testimonial.quote} »
              </p>
              <div className="mt-6">
                <h3 className="font-display text-lg font-bold text-white">{testimonial.name}</h3>
                <p className="mt-1 text-sm text-white/45">{testimonial.school}</p>
                <p className="mt-1 text-sm text-white/60">{testimonial.result}</p>
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
