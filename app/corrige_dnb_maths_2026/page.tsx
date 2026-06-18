import type { Metadata } from 'next';
import { Download, FileText, ShieldCheck, Sparkles } from 'lucide-react';

import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { PdfInlinePreview } from '@/components/pdf/PdfInlinePreview';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

const PDF_URL = '/documents/Corrige_DNB_Maths_2026_Nexus_Reussite.pdf';
const PREVIEW_URL = '/api/public-documents/corrige-dnb-maths-2026';

export const metadata: Metadata = {
  title: 'Corrigé DNB Maths 2026 | Nexus Réussite',
  description:
    'Consultez le corrigé DNB Maths 2026 de Nexus Réussite, disponible en accès direct et en téléchargement PDF.',
  alternates: {
    canonical: '/corrige_dnb_maths_2026',
  },
  openGraph: {
    title: 'Corrigé DNB Maths 2026 | Nexus Réussite',
    description:
      'Un corrigé clair et accessible en ligne, avec accès direct et téléchargement PDF.',
    type: 'article',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function CorrigeDnbMaths2026Page() {
  return (
    <main className="luxury min-h-screen bg-lux-paper" id="main-content">
      <CorporateNavbar />

      <section className="bg-lux-ink px-4 py-16 pt-28 md:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <Badge className="mb-4 border border-lux-line/40 bg-white/5 text-lux-gold-wash">
            <Sparkles className="mr-2 h-4 w-4" />
            Ressource publique
          </Badge>
          <h1 className="font-fraunces text-4xl font-light tracking-tight text-lux-ivory md:text-5xl">
            Corrigé DNB Maths 2026
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-lux-ivory/75">
            Consultez le document en ligne ou téléchargez-le directement au format PDF.
          </p>
        </div>
      </section>

      <section className="bg-lux-paper px-4 py-14 md:px-6">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-lux-line bg-lux-white lux-shadow">
            <CardContent className="p-4 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-lux-gold-deep">
                    Aperçu du document
                  </p>
                  <h2 className="mt-1 text-2xl font-fraunces text-lux-ink">
                    Accès direct au PDF
                  </h2>
                </div>
                <a
                  href={PDF_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lux-cta-reserve inline-flex items-center rounded-lg px-4 py-3 text-sm font-semibold"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Télécharger le PDF
                </a>
              </div>

              <div className="overflow-hidden rounded-2xl border border-dashed border-lux-line bg-lux-paper">
                <PdfInlinePreview
                  src={PREVIEW_URL}
                  title="Corrigé DNB Maths 2026"
                />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-lux-line bg-lux-ink text-lux-ivory lux-shadow">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-lux-gold-wash" />
                  <h2 className="text-lg font-fraunces text-lux-ivory">Ce que vous trouverez</h2>
                </div>
                <ul className="mt-4 space-y-3 text-sm text-lux-ivory/80">
                  <li className="flex gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-lux-evergreen" />
                    Une visionneuse PDF intégrée au site.
                  </li>
                  <li className="flex gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-lux-evergreen" />
                    Un téléchargement PDF au nom du document.
                  </li>
                  <li className="flex gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-lux-evergreen" />
                    Un accès public simple, sans inscription.
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-lux-line bg-lux-white lux-shadow">
              <CardContent className="p-6">
                <h2 className="text-lg font-fraunces text-lux-ink">Actions rapides</h2>
                <div className="mt-4 flex flex-col gap-3">
                  <a
                    href={PDF_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lux-cta-reserve inline-flex items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold"
                  >
                    Ouvrir le PDF
                  </a>
                  <a
                    href={PDF_URL}
                    download
                    className="lux-cta-secondary inline-flex items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold text-lux-ink border-lux-line/40"
                  >
                    Enregistrer sur l’appareil
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <CorporateFooter />
    </main>
  );
}
