'use client';

import Link from 'next/link';
import { CalendarDays, CheckCircle2, MapPin, MessageCircle, ArrowRight } from 'lucide-react';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getPacks, getStageEditions, getStageFormats } from '@/lib/pricing';
import { fmtTND } from '@/components/premium/format';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

const editionObjectives: Record<string, string> = {
  'cap-rentree': "Reprendre le rythme et prendre de l'avance dès la rentrée.",
  toussaint: 'Sécuriser les acquis du premier trimestre.',
  noel: 'Faire le point à mi-parcours et combler les écarts.',
  fevrier: 'Préparer les bacs blancs et renforcer les spécialités.',
  printemps: 'Installer les automatismes avant les épreuves.',
  sprint: 'La dernière ligne droite, dense et ciblée.',
};

const pillars = [
  'Prise d’avance',
  'Remise à niveau',
  'Stages par matière',
  'Présentiel à Mutuelleville ou en ligne',
  'Groupes réduits',
  'Bilan et pré-inscription',
];

export default function Stages2026Page() {
  const stageEditions = getStageEditions();
  const stageFormats = getStageFormats();
  const passIntensifs = getPacks().filter((pack) => pack.id.startsWith('pass-intensifs'));
  const lowestStagePrice = Math.min(...stageFormats.map((format) => format.price_per_student));

  return (
    <main className="luxury" id="main-content">
      <CorporateNavbar />

      <section className="bg-lux-ink py-16 px-4 md:px-6 pt-28">
        <div className="mx-auto max-w-5xl">
          <Badge className="border border-lux-line/40 bg-white/5 text-lux-gold-wash">
            Stages 2026/2027
          </Badge>
          <h1 className="mt-4 max-w-3xl text-4xl md:text-5xl font-fraunces font-light text-lux-ivory">
            Des stages utiles, structurés et pensés pour la progression réelle
          </h1>
          <p className="mt-4 max-w-3xl text-base text-lux-on-dark-muted">
            Les dates précises sont communiquées selon le niveau, l’établissement et la formule recommandée.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/bilan-gratuit?source=stages" className="lux-cta-reserve rounded-lg px-6 py-3.5 text-sm font-semibold">
              Pré-inscription
            </Link>
            <a href={buildWhatsAppUrl('les stages Nexus')} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-lg border border-lux-line/40 px-6 py-3.5 text-sm font-semibold text-lux-ivory min-h-[44px]">
              <MessageCircle className="mr-2 h-4 w-4" />
              Écrire sur WhatsApp
            </a>
            <Link href="/offres#les-intensifs" className="inline-flex items-center justify-center rounded-lg border border-lux-line/40 px-6 py-3.5 text-sm font-semibold text-lux-ivory min-h-[44px]">
              Voir tous les formats & tarifs
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-lux-paper py-14 px-4 md:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {stageEditions.map((edition) => (
              <Card key={edition.edition_id} className="border-lux-line bg-lux-ink text-lux-ivory">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 text-lux-gold">
                    <CalendarDays className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-[0.2em]">Période</span>
                  </div>
                  <h2 className="mt-3 text-xl font-fraunces text-lux-ivory">{edition.title}</h2>
                  <p className="mt-1 text-sm text-lux-gold-wash">{edition.period}</p>
                  <p className="mt-2 text-sm text-lux-on-dark-muted">
                    {editionObjectives[edition.edition_id] ?? 'Objectif communiqué avec la recommandation pédagogique.'}
                  </p>
                  <p className="mt-3 text-xs text-lux-on-dark-subtle">
                    Formats : {edition.formats.join(', ')}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 px-4 md:px-6">
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
                Les stages sont pensés pour fonctionner en présentiel à Mutuelleville ou à distance selon la formule recommandée.
              </p>
              <div className="mt-6 space-y-3 text-sm text-lux-on-dark-muted">
                <div>Groupes réduits pour garder un vrai suivi.</div>
                <div>Bilan avant inscription pour orienter le bon niveau.</div>
                <div>Préparation méthodique par matière et par objectif.</div>
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

      <section className="bg-lux-paper py-14 px-4 md:px-6">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_0.9fr]">
          <Card className="border-lux-line bg-lux-white text-lux-ink lux-shadow">
            <CardContent className="p-6 md:p-8">
              <h2 className="text-2xl font-fraunces text-lux-ink">Repères tarifaires</h2>
              <p className="mt-2 text-sm text-lux-slate">
                Formats intensifs dès {fmtTND(lowestStagePrice)}. Le détail complet est publié dans le catalogue.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {stageFormats.slice(0, 4).map((format) => (
                  <Link
                    key={format.format_id}
                    href={`/offres#${format.format_id}`}
                    className="rounded-xl border border-lux-line/70 p-4 text-sm transition hover:border-lux-gold/60"
                  >
                    <span className="block font-semibold text-lux-ink">{format.title}</span>
                    <span className="mt-1 block text-lux-slate">{format.hours}h · {fmtTND(format.price_per_student)}</span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-lux-line bg-lux-ink text-lux-ivory lux-shadow">
            <CardContent className="p-6 md:p-8">
              <h2 className="text-2xl font-fraunces text-lux-ivory">Le parcours complet, pas des stages isolés</h2>
              <p className="mt-3 text-sm leading-7 text-lux-on-dark-muted">
                Le Pass Intensifs Année permet d’inscrire les stages dans une progression suivie, avec acompte déductible et solde réglé avant chaque prestation.
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

      <section className="bg-lux-paper py-14 px-4 md:px-6">
        <div className="mx-auto max-w-5xl rounded-2xl border border-lux-line bg-lux-white p-6 md:p-8">
          <h2 className="text-2xl font-fraunces text-lux-ink">Prêt à sécuriser une place ?</h2>
          <p className="mt-2 text-sm text-lux-slate">
            Un bilan gratuit permet de confirmer le bon stage, le bon niveau et le bon rythme de travail.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/bilan-gratuit?source=stages" className="lux-cta-reserve rounded-lg px-6 py-3.5 text-sm font-semibold">
              Pré-inscription
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
