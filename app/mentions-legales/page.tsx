import React from 'react';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mentions Légales — Nexus Réussite',
  description: 'Mentions légales du site nexusreussite.academy — M&M ACADEMY SUARL.',
};

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-surface-darker text-neutral-100 font-sans">
      <CorporateNavbar />

      <main className="pt-32 pb-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-4xl font-bold mb-8 text-white">Mentions Légales</h1>

          <div className="bg-surface-card p-8 md:p-12 rounded-2xl shadow-premium border border-white/10 space-y-10 text-neutral-300 leading-relaxed">

            {/* 1. Éditeur */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-white">1. Éditeur du Site</h2>
              <p>
                Le site <strong className="text-white">nexusreussite.academy</strong> (ci-après « la Plateforme ») est édité par :
              </p>
              <ul className="mt-4 space-y-2">
                <li><strong className="text-white">Dénomination sociale :</strong> M&amp;M ACADEMY SUARL</li>
                <li><strong className="text-white">Enseigne / marque commerciale :</strong> Nexus Réussite</li>
                <li><strong className="text-white">Forme juridique :</strong> Société Unipersonnelle à Responsabilité Limitée (SUARL)</li>
                <li><strong className="text-white">Identifiant unique :</strong> 1948837N</li>
                <li><strong className="text-white">Siège social :</strong> Immeuble VENUS, Appt C13, Centre Urbain Nord, 1082 Tunis, Tunisie</li>
                <li><strong className="text-white">Téléphone :</strong> +216 99 19 28 29</li>
                <li><strong className="text-white">Email de contact :</strong>{' '}
                  <a href="mailto:contact@nexusreussite.academy" className="text-brand-accent underline">contact@nexusreussite.academy</a>
                </li>
              </ul>
            </section>

            {/* 2. Directrice de publication */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-white">2. Représentation légale &amp; Direction de la publication</h2>
              <ul className="space-y-2">
                <li><strong className="text-white">Représentante légale / Gérante :</strong> Mme Molka MEZZEZ</li>
                <li><strong className="text-white">Directrice de la publication :</strong> Mme Molka MEZZEZ</li>
              </ul>
            </section>

            {/* 3. Contact technique */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-white">3. Contact technique (Webmaster)</h2>
              <ul className="space-y-2">
                <li><strong className="text-white">Responsable technique :</strong> Alaeddine BEN RHOUMA</li>
                <li><strong className="text-white">Email :</strong>{' '}
                  <a href="mailto:admin@nexusreussite.academy" className="text-brand-accent underline">admin@nexusreussite.academy</a>
                </li>
              </ul>
            </section>

            {/* 4. Hébergement */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-white">4. Hébergement</h2>
              <p className="mb-4">La Plateforme est hébergée par les prestataires suivants :</p>

              <div className="pl-4 border-l-4 border-cyan-500 mb-4 space-y-1">
                <h3 className="font-bold text-lg text-white">Hostinger International Ltd</h3>
                <p>61 Lordou Vironos Street, 6023 Larnaca, Chypre</p>
                <p>Site : <a href="https://www.hostinger.fr" target="_blank" rel="noopener noreferrer" className="text-brand-accent underline">www.hostinger.fr</a></p>
              </div>

              <div className="pl-4 border-l-4 border-cyan-500 space-y-1">
                <h3 className="font-bold text-lg text-white">Hetzner Online GmbH (serveur dédié / infrastructure applicative)</h3>
                <p>Industriestr. 25, 91710 Gunzenhausen, Allemagne</p>
                <p>Registre : AG Ansbach, HRB 6089</p>
                <p>Site : <a href="https://www.hetzner.com/legal/legal-notice" target="_blank" rel="noopener noreferrer" className="text-brand-accent underline">www.hetzner.com</a></p>
              </div>
            </section>

            {/* 5. Activité */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-white">5. Activité</h2>
              <p>
                M&amp;M ACADEMY SUARL, sous l&apos;enseigne <strong className="text-white">Nexus Réussite</strong>, fournit des services de soutien à l&apos;enseignement comprenant :
              </p>
              <ul className="mt-3 list-disc pl-5 space-y-1">
                <li>Accompagnement scolaire personnalisé (tutorat en ligne et/ou en présentiel)</li>
                <li>Accès à une plateforme e-learning (contenus pédagogiques, IA éducative « ARIA »)</li>
                <li>Stages intensifs et packs de préparation aux examens</li>
              </ul>
            </section>

            {/* 6. Propriété intellectuelle */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-white">6. Propriété intellectuelle</h2>
              <p>
                L&apos;ensemble des éléments du site (textes, images, vidéos, logiciels, code source, design, bases de données, marques et logos)
                sont la propriété exclusive de M&amp;M ACADEMY SUARL ou de ses partenaires licenciés.
              </p>
              <p className="mt-3">
                Toute reproduction, représentation, modification, diffusion, extraction ou réutilisation, totale ou partielle,
                de ces éléments sans autorisation écrite préalable est strictement interdite et constitue une contrefaçon
                au sens du Code de la propriété intellectuelle applicable.
              </p>
            </section>

            {/* 7. Données personnelles */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-white">7. Données personnelles &amp; Protection de la vie privée</h2>
              <p className="mb-3">
                M&amp;M ACADEMY SUARL collecte et traite des données personnelles (nom, email, téléphone, données scolaires) exclusivement
                pour les finalités suivantes :
              </p>
              <ul className="list-disc pl-5 space-y-1 mb-4">
                <li>Création et gestion des comptes utilisateurs (parents et élèves)</li>
                <li>Exécution des services (suivi pédagogique, facturation, communication)</li>
                <li>Amélioration de la Plateforme (statistiques anonymisées)</li>
              </ul>
              <p className="mb-3">
                <strong className="text-white">Droits des utilisateurs :</strong> Conformément à la loi organique n° 2004-63 du 27 juillet 2004 relative à la protection des données à caractère personnel en Tunisie, vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;opposition et de suppression de vos données.
              </p>
              <p className="mb-3">
                <strong className="text-white">Délégué à la protection des données (DPO) :</strong>{' '}
                <a href="mailto:dpo@nexusreussite.academy" className="text-brand-accent underline">dpo@nexusreussite.academy</a>
              </p>
              <p>
                <strong className="text-white">Paiement :</strong> Les transactions par carte bancaire sont traitées exclusivement par le prestataire de paiement <strong className="text-white">ClicToPay</strong> (Banque Zitouna). M&amp;M ACADEMY SUARL ne collecte, ne stocke et ne journalise jamais le cryptogramme visuel (CVV/CVC) de votre carte. L&apos;ensemble des données de carte est traité par le prestataire dans un environnement sécurisé.
              </p>
            </section>

            {/* 8. Cookies */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-white">8. Cookies et traceurs</h2>
              <p className="mb-3">La Plateforme utilise des cookies pour :</p>
              <ul className="list-disc pl-5 space-y-1 mb-3">
                <li><strong className="text-white">Fonctionnement :</strong> authentification, préférences de session (strictement nécessaires)</li>
                <li><strong className="text-white">Mesure d&apos;audience :</strong> statistiques de fréquentation anonymisées</li>
                <li><strong className="text-white">Expérience utilisateur :</strong> mémorisation des préférences (langue, thème)</li>
              </ul>
              <p>
                Vous pouvez configurer votre navigateur pour refuser les cookies non essentiels. La désactivation de certains cookies peut limiter l&apos;accès à certaines fonctionnalités.
              </p>
            </section>

            {/* 9. Responsabilité */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-white">9. Limitation de responsabilité</h2>
              <p className="mb-3">
                M&amp;M ACADEMY SUARL s&apos;engage à assurer la disponibilité de la Plateforme dans le cadre d&apos;une <strong className="text-white">obligation de moyens</strong>.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Des interruptions temporaires (maintenance, mise à jour) pourront survenir sans engager la responsabilité de l&apos;éditeur.</li>
                <li>Les liens hypertextes vers des sites tiers sont fournis à titre informatif ; M&amp;M ACADEMY SUARL ne saurait être tenu responsable de leur contenu.</li>
                <li>En aucun cas M&amp;M ACADEMY SUARL ne pourra être tenu responsable de dommages indirects résultant de l&apos;utilisation ou de l&apos;impossibilité d&apos;utiliser la Plateforme.</li>
              </ul>
            </section>

            {/* 10. Droit applicable */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-white">10. Droit applicable et juridiction compétente</h2>
              <p className="mb-3">
                Les présentes mentions légales sont régies par le <strong className="text-white">droit tunisien</strong>. Tout litige relatif à l&apos;utilisation de la Plateforme sera soumis aux <strong className="text-white">juridictions compétentes de Tunis, Tunisie</strong>.
              </p>
              <p className="text-sm text-neutral-400">
                Sous réserve des dispositions impératives de protection du consommateur applicables dans le pays de résidence de l&apos;utilisateur, le cas échéant.
              </p>
            </section>

            {/* Date */}
            <div className="pt-6 border-t border-white/10 text-sm text-neutral-400">
              <p>Dernière mise à jour : 1er mars 2026</p>
            </div>
          </div>
        </div>
      </main>

      <CorporateFooter />
    </div>
  );
}
