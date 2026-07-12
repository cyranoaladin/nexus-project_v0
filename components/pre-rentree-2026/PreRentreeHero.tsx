import { buildWhatsAppUrl } from '@/lib/whatsapp';

interface PreRentreeHeroProps {
  campaign: {
    startDate: string;
    endDate: string;
    venue: { name: string; neighborhood: string };
  };
  levels: Array<{ id: string; label: string }>;
  subjects: Array<{ id: string; label: string }>;
}

export function PreRentreeHero({ campaign, levels, subjects }: PreRentreeHeroProps) {
  const whatsappUrl = buildWhatsAppUrl('les stages de pré-rentrée 2026');

  return (
    <section className="bg-lux-ink py-16 md:py-24 px-4" aria-labelledby="hero-heading">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs uppercase tracking-[0.2em] text-lux-gold-wash mb-4">
          Stages de pré-rentrée 2026 · {campaign.venue.neighborhood}, Tunis
        </p>
        <h1 id="hero-heading" className="font-fraunces text-3xl md:text-5xl lg:text-6xl text-lux-on-dark mb-6 max-w-3xl">
          Deux semaines pour préparer sérieusement la rentrée
        </h1>
        <p className="text-lg md:text-xl text-lux-on-dark-muted max-w-2xl mb-8">
          Du 17 au 28 août 2026, pour les élèves entrant en {levels.map(l => l.label).join(', ')}.
          Une à quatre matières au choix parmi les {subjects.map(s => s.label).join(', ')}.
        </p>

        <div className="flex flex-wrap gap-3 mb-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-lux-on-dark">
            17–28 août 2026
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-lux-on-dark">
            5 séances de 2 h par matière
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-lux-on-dark">
            3 à 5 élèves
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-lux-on-dark">
            Présentiel à {campaign.venue.neighborhood}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-lux-on-dark">
            1 à 4 matières
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="#configurateur"
            className="inline-flex items-center justify-center rounded-lg bg-lux-gold px-6 py-3 text-sm font-semibold text-lux-ink transition-colors hover:bg-lux-gold-bright min-h-[44px]"
          >
            Composer le stage de mon enfant
          </a>
          <a
            href="#planning"
            className="inline-flex items-center justify-center rounded-lg border border-white/20 px-6 py-3 text-sm font-semibold text-lux-on-dark transition-colors hover:bg-white/5 min-h-[44px]"
          >
            Voir les horaires
          </a>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg bg-[#25D366]/10 border border-[#25D366]/30 px-6 py-3 text-sm font-semibold text-[#25D366] transition-colors hover:bg-[#25D366]/20 min-h-[44px]"
          >
            Poser une question
          </a>
        </div>
      </div>
    </section>
  );
}
