'use client';

import Link from 'next/link';
import { CalendarDays, CheckCircle2, Clock, MapPin, MessageCircle, ArrowRight, Users, BookOpen } from 'lucide-react';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getStageCalendar, getStageFormat, isFormatPriceValidated, getPacks, getRules } from '@/lib/pricing';
import { fmtTND } from '@/components/premium/format';
import { StagePriceLabel } from './_components/StagePriceLabel';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

const pillars = [
  'Prise d\u2019avance',
  'Remise \u00e0 niveau',
  'Stages par mati\u00e8re',
  'Pr\u00e9sentiel \u00e0 Mutuelleville ou en ligne',
  'Groupes r\u00e9duits',
  'Bilan et pr\u00e9-inscription',
];

export default function Stages2026Page() {
  const calendar = getStageCalendar();
  const rules = getRules();
  const passIntensifs = getPacks().filter((pack) => pack.id.startsWith('pass-intensifs'));

  return (
    <main className="luxury" id="main-content">
      <CorporateNavbar />

      <section className="bg-lux-ink py-16 px-4 md:px-6 pt-28">
        <div className="mx-auto max-w-5xl">
          <Badge className="border border-lux-line/40 bg-white/5 text-lux-gold-wash">
            Stages 2026/2027
          </Badge>
          <h1 className="mt-4 max-w-3xl text-4xl md:text-5xl font-fraunces font-light text-lux-ivory">
            Viser. Atteindre. D\u00e9passer.
          </h1>
          <p className="mt-4 max-w-3xl text-base text-lux-on-dark-muted">
            Des stages structur\u00e9s, cal\u00e9s sur les vacances du calendrier officiel,
            pour progresser en groupe de {rules.group_max} maximum.
            Unit\u00e9\u00A0: la demi-journ\u00e9e de 3\u00A0h.
          </p>
          <p className="mt-2 text-sm text-lux-on-dark-subtle">
            Mati\u00e8res\u00A0: Maths \u00b7 NSI \u00b7 Fran\u00e7ais (EAF) \u00b7 Philo
            &mdash; inscrits en réseau AEFE et candidats libres
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/bilan-gratuit?source=stages" className="lux-cta-reserve rounded-lg px-6 py-3.5 text-sm font-semibold">
              Pr\u00e9-inscription
            </Link>
            <a href={buildWhatsAppUrl('les stages Nexus')} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-lg border border-lux-line/40 px-6 py-3.5 text-sm font-semibold text-lux-ivory min-h-[44px]">
              <MessageCircle className="mr-2 h-4 w-4" />
              \u00c9crire sur WhatsApp
            </a>
            <Link href="/offres#les-intensifs" className="inline-flex items-center justify-center rounded-lg border border-lux-line/40 px-6 py-3.5 text-sm font-semibold text-lux-ivory min-h-[44px]">
              Voir tous les formats & tarifs
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Calendrier 2026-2027 */}
      <section className="bg-lux-paper py-14 px-4 md:px-6" aria-label="Calendrier des stages 2026-2027">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl md:text-3xl font-fraunces text-lux-ink mb-8">
            Calendrier 2026-2027
          </h2>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {calendar.map((stage) => {
              const format = getStageFormat(stage.format_id);
              const priceValidated = format && isFormatPriceValidated(format);
              const price = priceValidated ? format.price_per_student : null;
              return (
                <Card key={stage.id} className="border-lux-line bg-lux-ink text-lux-ivory">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 text-lux-gold">
                      <CalendarDays className="h-4 w-4" />
                      <span className="text-xs font-semibold uppercase tracking-[0.2em]">{stage.format_label}</span>
                    </div>
                    <h3 className="mt-3 text-xl font-fraunces text-lux-ivory">{stage.title}</h3>
                    <p className="mt-1 text-sm font-medium text-lux-gold-wash" data-testid={`stage-dates-${stage.id}`}>
                      {stage.dates_display}
                    </p>
                    <p className="mt-2 text-sm text-lux-on-dark-muted">
                      {stage.objective}
                    </p>
                    {stage.notes && (
                      <p className="mt-1 text-xs text-lux-gold-wash italic">
                        {stage.notes}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 text-xs text-lux-on-dark-subtle">
                        <Clock className="h-3 w-3" /> {stage.hours}\u00A0h ({stage.half_days} demi-journ\u00e9es)
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-lux-on-dark-subtle">
                        <Users className="h-3 w-3" /> {rules.group_max} max
                      </span>
                      <StagePriceLabel price={price} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {stage.subjects.map((s) => (
                        <span key={s} className="rounded-full border border-lux-line/40 bg-white/5 px-2 py-0.5 text-[0.6rem] text-lux-on-dark-subtle">
                          {s}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Formats */}
      <section className="py-14 px-4 md:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl md:text-3xl font-fraunces text-lux-ink mb-6">
            Trois formats, une unit\u00e9\u00A0: la demi-journ\u00e9e de 3\u00A0h
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { label: 'EXPRESS', hours: 9, halfDays: 3, desc: 'Mise au point cibl\u00e9e sur une p\u00e9riode courte.' },
              { label: 'INTENSIF', hours: 15, halfDays: 5, desc: 'Le format de r\u00e9f\u00e9rence\u00A0: une semaine compl\u00e8te de travail.' },
              { label: 'PR\u00c9PA-BAC', hours: 30, halfDays: 10, desc: 'Deux semaines de pr\u00e9paration intensive avant les \u00e9preuves.' },
            ].map((f) => (
              <Card key={f.label} className="border-lux-line bg-lux-white lux-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 text-lux-gold-deep">
                    <BookOpen className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-[0.2em]">{f.label}</span>
                  </div>
                  <p className="mt-3 text-2xl font-fraunces text-lux-ink">{f.hours}\u00A0h</p>
                  <p className="mt-1 text-sm text-lux-slate">{f.halfDays} demi-journ\u00e9es \u00d7 3\u00A0h</p>
                  <p className="mt-3 text-sm text-lux-slate">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-lux-paper py-14 px-4 md:px-6">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_0.9fr]">
          <Card className="border-lux-line bg-lux-ink text-lux-ivory">
            <CardContent className="p-6 md:p-8">
              <h2 className="text-2xl md:text-3xl font-fraunces text-lux-ivory">Ce que couvrent les stages</h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {pillars.map((pillar) => (
                  <div key={pillar} className="flex items-center gap-3 rounded-lg border border-lux-line/50 px-4 py-3">
                    <CheckCircle2 className="h-4 w-4 text-lux-evergreen" />
                    <span className="text-sm text-lux-on-dark-muted">{pillar}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-lux-line bg-lux-ink text-lux-ivory">
            <CardContent className="p-6 md:p-8">
              <div className="flex items-center gap-2 text-lux-gold-wash">
                <MapPin className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.2em]">Format</span>
              </div>
              <h2 className="mt-3 text-2xl font-fraunces text-lux-ivory">Mutuelleville ou en ligne</h2>
              <p className="mt-3 text-sm text-lux-on-dark-muted">
                Les stages sont pens\u00e9s pour fonctionner en pr\u00e9sentiel \u00e0 Mutuelleville ou \u00e0 distance selon la formule recommand\u00e9e.
              </p>
              <div className="mt-6 space-y-3 text-sm text-lux-on-dark-muted">
                <div>Groupes de {rules.group_max} pour garder un vrai suivi.</div>
                <div>Bilan avant inscription pour orienter le bon niveau.</div>
                <div>Pr\u00e9paration m\u00e9thodique par mati\u00e8re et par objectif.</div>
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/bilan-gratuit?source=stages" className="lux-cta-reserve rounded-lg px-6 py-3.5 text-sm font-semibold">
                  Demander un bilan
                </Link>
                <Button asChild variant="outline" className="border-lux-line/40 text-lux-ivory hover:bg-white/5">
                  <Link href="/offres#les-intensifs">
                    Voir tous les formats & tarifs
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Pass intensifs */}
      {passIntensifs.length > 0 && (
        <section className="bg-lux-paper py-14 px-4 md:px-6">
          <div className="mx-auto max-w-5xl">
            <Card className="border-lux-line bg-lux-ink text-lux-ivory lux-shadow">
              <CardContent className="p-6 md:p-8">
                <h2 className="text-2xl font-fraunces text-lux-ivory">Le parcours complet, pas des stages isol\u00e9s</h2>
                <p className="mt-3 text-sm leading-7 text-lux-on-dark-muted">
                  Le Pass Intensifs Ann\u00e9e permet d\u2019inscrire les stages dans une progression suivie, avec acompte d\u00e9ductible et solde r\u00e9gl\u00e9 avant chaque prestation.
                </p>
                <div className="mt-5 space-y-3">
                  {passIntensifs.map((pack) => (
                    <Link
                      key={pack.id}
                      href={`/offres#${pack.id}`}
                      className="flex min-h-[44px] items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-lux-ivory hover:border-lux-gold/50"
                    >
                      <span>{pack.title}</span>
                      <span className="lux-price text-lux-gold-wash">{fmtTND(pack.price)}</span>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      <section className="bg-lux-paper py-14 px-4 md:px-6">
        <div className="mx-auto max-w-5xl rounded-2xl border border-lux-line bg-lux-white p-6 md:p-8">
          <h2 className="text-2xl font-fraunces text-lux-ink">Pr\u00eat \u00e0 s\u00e9curiser une place\u00A0?</h2>
          <p className="mt-2 text-sm text-lux-slate">
            Un bilan gratuit permet de confirmer le bon stage, le bon niveau et le bon rythme de travail.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/bilan-gratuit?source=stages" className="lux-cta-reserve rounded-lg px-6 py-3.5 text-sm font-semibold">
              Pr\u00e9-inscription
            </Link>
            <a href={buildWhatsAppUrl('les stages Nexus')} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-lg border border-lux-line px-6 py-3.5 text-sm font-semibold text-lux-ink min-h-[44px]">
              <MessageCircle className="mr-2 h-4 w-4" />
              WhatsApp
            </a>
          </div>
        </div>
      </section>

      <CorporateFooter />
    </main>
  );
}
