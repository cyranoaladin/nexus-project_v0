import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { resolveShareLinkContext } from '@/lib/bilans/staff/share-link-service';
import { LEGAL } from '@/lib/legal';

import { FamilyLandingConsent } from './family-landing-consent';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Votre bilan — Nexus Réussite',
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Page d'accueil famille d'un bilan diffusé — l'arrivée du lien WhatsApp.
 *
 * Le lien signé est la preuve : pas d'authentification. La page présente le
 * bilan (lecture intégrée + téléchargement PDF) puis, pour le lien parents,
 * propose en une seule étape de confirmer le consentement et de créer
 * l'accès. La consultation du document reste journalisée par la sous-route
 * /document ; l'affichage de cette page d'accueil, lui, ne consomme rien.
 *
 * Tout jeton défaillant — altéré, expiré, révoqué, bilan retiré — reçoit la
 * même réponse uniforme : introuvable.
 */
export default async function FamilyLandingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const context = await resolveShareLinkContext(token);
  if (context === null) notFound();
  const { readPublishedVersionReplacement } = await import('@/lib/bilans/staff/share-link-service');
  const updatedVersion = await readPublishedVersionReplacement(context.reportArtifactId);

  const isParentAudience = context.audience === 'PARENTS';
  const firstName = context.studentFirstName?.trim() || 'votre enfant';
  const expiresLabel = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(context.expiresAt);

  return (
    <div className="luxury min-h-screen bg-lux-ink text-lux-ivory">
      <main className="mx-auto max-w-5xl px-6 py-12 md:py-16">
        <header className="lux-fade-in">
          <p className="lux-eyebrow text-lux-gold">Nexus Réussite · Bilan de positionnement</p>
          <h1 className="mt-3 font-fraunces text-3xl font-light tracking-tight text-lux-ivory md:text-4xl">
            {isParentAudience
              ? <>Le bilan de {firstName} est prêt</>
              : <>Ton bilan est prêt, {firstName}</>}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-lux-on-dark-muted">
            {isParentAudience
              ? 'Vous consultez le document destiné aux parents. Il se lit ci-dessous et se télécharge en PDF. Ce lien est personnel : ne le partagez pas.'
              : 'Tu consultes ton document. Il se lit ci-dessous et se télécharge en PDF. Ce lien est personnel : ne le partage pas.'}
          </p>
          {updatedVersion !== null && (
            <p
              className="mt-5 max-w-2xl rounded-2xl border border-lux-gold/40 bg-lux-gold/10 px-4 py-3 text-sm leading-6 text-lux-ivory"
              data-testid="version-mise-a-jour"
            >
              Version mise à jour le {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(updatedVersion.updatedAt)} —
              elle remplace la version du {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(updatedVersion.replacesDate)}.
              {isParentAudience
                ? ' Notre équipe a affiné la lecture pédagogique de certains points ; votre accès, lui, reste le même.'
                : ' Notre équipe a affiné la lecture de certains points de ton bilan ; ton accès, lui, reste le même.'}
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <a
              href={`/bilan/consultation/${encodeURIComponent(token)}/pdf`}
              className="lux-cta-primary lux-focus inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold"
            >
              Télécharger le PDF
            </a>
            <span className="text-xs text-lux-on-dark-subtle">
              Lien valable jusqu'au {expiresLabel}.
            </span>
          </div>
        </header>

        {isParentAudience ? (
          <section aria-label="Consentement et accès" className="lux-fade-in-delay mt-10">
            <FamilyLandingConsent token={token} studentFirstName={firstName} />
          </section>
        ) : null}

        <section aria-label="Lecture du bilan" className="mt-10">
          <div className="overflow-hidden rounded-[28px] border border-lux-line/40 bg-lux-paper shadow-premium">
            <iframe
              src={`/bilan/consultation/${encodeURIComponent(token)}/document`}
              title="Bilan de positionnement"
              className="h-[75vh] w-full border-0 bg-lux-paper"
              sandbox="allow-same-origin"
              referrerPolicy="no-referrer"
            />
          </div>
        </section>

        <footer className="mt-10 border-t border-lux-line/30 pt-6 text-xs leading-6 text-lux-on-dark-subtle">
          <p>
            Document confidentiel destiné à la famille. Pour toute question,
            écrivez-nous à {LEGAL.contact.email} — l'équipe vous
            répond rapidement.
          </p>
        </footer>
      </main>
    </div>
  );
}
