import Link from 'next/link';
import { CheckCircle, Clock, Mail, Phone } from 'lucide-react';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { Card, CardContent } from '@/components/ui/card';
import { LEGAL } from '@/lib/legal';

export default function ConfirmationPage() {
  return (
    <main className="luxury min-h-screen" id="main-content">
      <CorporateNavbar />

      <section className="bg-lux-ink px-4 py-16 pt-28 md:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-full border border-lux-gold/25 bg-lux-gold/10">
            <CheckCircle className="h-10 w-10 text-lux-gold-wash" aria-hidden="true" />
          </div>
          <h1 className="mt-8 font-fraunces text-4xl font-light tracking-tight text-lux-ivory md:text-5xl">
            Votre demande de bilan a bien été enregistrée
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-lux-on-dark-muted">
            Notre équipe pédagogique va analyser votre demande et vous recontacter pour orienter la meilleure formule.
          </p>
        </div>
      </section>

      <section className="bg-lux-paper px-4 py-14 md:px-6">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          <Card className="border-lux-line bg-lux-white text-lux-ink lux-shadow">
            <CardContent className="p-6 text-center">
              <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-lux-gold/12">
                <Clock className="h-6 w-6 text-lux-gold" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-xl font-fraunces text-lux-ink">Sous 24h</h2>
              <p className="mt-2 text-sm text-lux-slate">
                Notre équipe analyse votre profil et prépare votre bilan personnalisé.
              </p>
            </CardContent>
          </Card>

          <Card className="border-lux-line bg-lux-white text-lux-ink lux-shadow">
            <CardContent className="p-6 text-center">
              <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-lux-gold/12">
                <Phone className="h-6 w-6 text-lux-gold" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-xl font-fraunces text-lux-ink">Appel découverte</h2>
              <p className="mt-2 text-sm text-lux-slate">
                Un échange pour comprendre vos besoins et présenter nos solutions.
              </p>
            </CardContent>
          </Card>

          <Card className="border-lux-line bg-lux-white text-lux-ink lux-shadow">
            <CardContent className="p-6 text-center">
              <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-lux-gold/12">
                <CheckCircle className="h-6 w-6 text-lux-evergreen" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-xl font-fraunces text-lux-ink">Plan d’action</h2>
              <p className="mt-2 text-sm text-lux-slate">
                Nous vous proposons un plan personnalisé pour la progression de votre enfant.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="bg-lux-paper px-4 py-14 md:px-6">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="border-lux-line bg-lux-white text-lux-ink lux-shadow">
            <CardContent className="p-6 md:p-8">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-lux-gold" />
                <h2 className="text-2xl font-fraunces text-lux-ink">Vérifiez votre boîte email</h2>
              </div>
              <p className="mt-4 text-sm leading-6 text-lux-slate">
                Un email de confirmation a été envoyé avec les prochaines étapes de prise en charge.
                Si vous ne le trouvez pas, pensez à vérifier vos spams.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/offres" className="lux-cta-reserve rounded-lg px-6 py-3.5 text-sm font-semibold">
                  Voir les offres
                </Link>
                <Link href="/" className="lux-cta-secondary rounded-lg px-6 py-3.5 text-sm font-semibold text-lux-ink border-lux-line/40">
                  Retour à l’accueil
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="border-lux-line bg-lux-ink text-lux-ivory lux-shadow">
            <CardContent className="p-6 md:p-8">
              <h2 className="text-2xl font-fraunces text-lux-ivory">Contact direct</h2>
              <p className="mt-3 text-sm text-lux-on-dark-muted">
                Une question urgente ? Contactez-nous directement.
              </p>
              <div className="mt-6 space-y-3">
                <a
                  href={`tel:${LEGAL.contact.phoneRaw}`}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-lux-ivory transition-colors hover:border-lux-gold/40 hover:bg-white/10"
                >
                  <Phone className="h-4 w-4 text-lux-gold-wash" aria-hidden="true" />
                  {LEGAL.contact.phone}
                </a>
                <a
                  href={`mailto:${LEGAL.contact.email}`}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-lux-ivory transition-colors hover:border-lux-gold/40 hover:bg-white/10"
                >
                  <Mail className="h-4 w-4 text-lux-gold-wash" aria-hidden="true" />
                  {LEGAL.contact.email}
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <CorporateFooter />
    </main>
  );
}
