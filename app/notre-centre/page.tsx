'use client';

import Link from 'next/link';
import { ArrowRight, MapPin, Phone, Mail, Clock, CheckCircle2 } from 'lucide-react';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

const PEDA_ADDRESS = 'Mutuelleville, Tunis';
const WHATSAPP_URL = 'https://wa.me/21699192829';

export default function NotreCentrePage() {
  return (
    <main className="luxury min-h-screen" id="main-content">
      <CorporateNavbar />

      <section className="bg-lux-ink py-16 px-4 md:px-6 pt-28">
        <div className="mx-auto max-w-5xl text-center">
          <Badge className="mb-4 border border-lux-line/40 bg-white/5 text-lux-gold-wash">
            Centre pédagogique
          </Badge>
          <h1 className="font-fraunces text-4xl font-light tracking-tight text-lux-ivory md:text-5xl">
            Mutuelleville, le centre d’accompagnement pédagogique
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-lux-ivory/75">
            Les rendez-vous pédagogiques et cours en présentiel se déroulent à Mutuelleville, sur confirmation.
          </p>
        </div>
      </section>

      <section className="bg-lux-paper py-14 px-4 md:px-6">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_1.1fr]">
          <Card className="border-lux-line bg-lux-white lux-shadow">
            <CardContent className="p-6 md:p-8">
              <h2 className="text-2xl font-fraunces text-lux-ink">Informations pratiques</h2>
              <div className="mt-6 space-y-4 text-sm text-lux-slate">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 text-lux-gold" />
                  <div>
                    <p className="font-semibold text-lux-ink">Centre d’accompagnement pédagogique</p>
                    <p className="mt-1">{PEDA_ADDRESS}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-lux-gold" />
                  <span>Sur confirmation, selon le créneau recommandé</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-lux-gold" />
                  <span>+216 99 19 28 29</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-lux-gold" />
                  <span>contact@nexusreussite.academy</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-lux-line bg-lux-ink text-lux-ivory lux-shadow">
            <CardContent className="p-6 md:p-8">
              <h2 className="text-2xl font-fraunces !text-lux-ivory">Ce que vous trouvez sur place</h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  'Salles adaptées aux groupes réduits',
                  'Espace de travail calme et structuré',
                  'Suivi pédagogique clair',
                  'Orientation avant inscription',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                    <CheckCircle2 className="h-4 w-4 text-lux-evergreen" />
                    <span className="text-sm text-lux-ivory">{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/contact" className="lux-cta-secondary rounded-lg px-6 py-3.5 text-sm font-semibold text-lux-ivory border-white/10">
                  Contacter l’équipe
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="lux-cta-reserve rounded-lg px-6 py-3.5 text-sm font-semibold">
                  Écrire sur WhatsApp
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="bg-lux-paper py-14 px-4 md:px-6">
        <div className="mx-auto max-w-6xl rounded-2xl border border-lux-line bg-lux-white p-6 md:p-8 lux-shadow">
          <h2 className="text-2xl font-fraunces text-lux-ink">Accès et confirmation</h2>
          <p className="mt-2 max-w-3xl text-sm text-lux-slate">
            Les rendez-vous sont confirmés au préalable afin d’assurer un cadre de travail calme et adapté au niveau de l’élève.
          </p>
        </div>
      </section>

      <CorporateFooter />
    </main>
  );
}
