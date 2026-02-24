import React from 'react';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Conditions Générales (CGU + CGV) — Nexus Réussite',
  description:
    'Conditions Générales d\'Utilisation et de Vente du site nexusreussite.academy — M&M ACADEMY SUARL.',
};

export default function ConditionsGeneralesPage() {
  const CGV_VERSION = '1.0';
  void CGV_VERSION; // used in JSX below
  return (
    <div className="min-h-screen bg-surface-darker text-neutral-100 font-sans">
      <CorporateNavbar />

      <main className="pt-32 pb-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-4xl font-bold mb-4 text-white">Conditions Générales</h1>
          <p className="text-neutral-400 mb-8 text-sm">
            Version {CGV_VERSION} — En vigueur à compter du 1er mars 2026
          </p>

          <div className="bg-surface-card p-8 md:p-12 rounded-2xl shadow-premium border border-white/10 space-y-10 text-neutral-300 leading-relaxed">

            {/* ═══════════ PRÉAMBULE ═══════════ */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-white">Préambule</h2>
              <p className="mb-3">
                Les présentes Conditions Générales régissent l&apos;utilisation de la plateforme{' '}
                <strong className="text-white">nexusreussite.academy</strong> (ci-après « la Plateforme ») éditée par{' '}
                <strong className="text-white">M&amp;M ACADEMY SUARL</strong>, société de droit tunisien, identifiant unique 1948837N,
                dont le siège social est situé Immeuble VENUS, Appt C13, Centre Urbain Nord, 1082 Tunis, Tunisie,
                exploitant la marque commerciale <strong className="text-white">Nexus Réussite</strong>.
              </p>
              <p className="mb-3">
                Elles se composent de deux parties indissociables :
              </p>
              <ul className="list-disc pl-5 space-y-1 mb-3">
                <li><strong className="text-white">Partie I — Conditions Générales d&apos;Utilisation (CGU)</strong> : accès au site, comptes, obligations des utilisateurs.</li>
                <li><strong className="text-white">Partie II — Conditions Générales de Vente (CGV)</strong> : offres, prix, paiement, exécution, annulation, responsabilité.</li>
              </ul>
              <p>
                En accédant à la Plateforme ou en passant commande, l&apos;Utilisateur reconnaît avoir lu, compris et accepté les présentes Conditions Générales dans leur intégralité.
              </p>
            </section>

            {/* ═══════════ BLOC CHECKOUT ═══════════ */}
            <section id="checkout-legal" className="p-6 rounded-xl border-2 border-cyan-500/50 bg-cyan-500/5">
              <h2 className="text-xl font-bold mb-3 text-white">📋 À lire avant paiement (résumé obligatoire)</h2>
              <p className="mb-3 text-sm">
                Avant toute validation de paiement sur la Plateforme, le Client est informé que :
              </p>
              <ul className="list-disc pl-5 space-y-2 text-sm mb-3">
                <li>Les présentes <strong className="text-white">Conditions Générales (CGU + CGV)</strong> sont consultables à tout moment sur cette page et doivent être acceptées avant paiement.</li>
                <li>Les <strong className="text-white">prix sont affichés en Dinar Tunisien (TND)</strong>, toutes taxes comprises, avant validation de la commande.</li>
                <li>Le paiement est réalisé via <strong className="text-white">ClicToPay</strong> (Banque Zitouna) ou par virement bancaire.</li>
                <li>Les <strong className="text-white">cartes bancaires nationales et internationales</strong> sont acceptées.</li>
                <li>La sécurité des transactions est assurée par <strong className="text-white">CVV2</strong> et <strong className="text-white">3D Secure</strong>.</li>
                <li><strong className="text-white">Aucun frais additionnel</strong> n&apos;est facturé au Client du seul fait du paiement par carte bancaire.</li>
                <li>Le <strong className="text-white">cryptogramme visuel (CVV/CVC) n&apos;est jamais stocké</strong> par M&amp;M ACADEMY SUARL ni dans ses bases de données, ni dans ses journaux techniques.</li>
              </ul>
              <p className="text-xs text-neutral-400">
                Lors du paiement, une case à cocher « J&apos;ai lu et j&apos;accepte les Conditions Générales (CGU + CGV) » est requise. Le bouton « Payer » reste désactivé tant que cette case n&apos;est pas cochée.
              </p>
            </section>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* PARTIE I — CGU                                                 */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="pt-4 border-t border-white/10">
              <h2 className="text-3xl font-bold mb-2 text-white">Partie I — Conditions Générales d&apos;Utilisation (CGU)</h2>
              <p className="text-neutral-400 text-sm mb-8">Applicables à tout visiteur ou utilisateur inscrit de la Plateforme.</p>
            </div>

            {/* CGU 1 */}
            <section>
              <h3 className="text-xl font-bold mb-3 text-white">1. Objet et accès</h3>
              <p>
                La Plateforme offre des services d&apos;accompagnement scolaire (tutorat, e-learning, stages, IA éducative « ARIA »).
                L&apos;accès aux pages publiques est libre. L&apos;accès aux services nécessite la création d&apos;un compte.
              </p>
            </section>

            {/* CGU 2 */}
            <section>
              <h3 className="text-xl font-bold mb-3 text-white">2. Création de compte et authentification</h3>
              <p className="mb-3">
                L&apos;inscription requiert la fourniture d&apos;informations exactes (nom, prénom, email, téléphone).
                Le compte parent donne accès à la gestion des profils élèves rattachés.
              </p>
              <p>
                L&apos;Utilisateur est seul responsable de la confidentialité de ses identifiants.
                Tout accès réalisé avec ses identifiants est réputé effectué par lui.
              </p>
            </section>

            {/* CGU 3 */}
            <section>
              <h3 className="text-xl font-bold mb-3 text-white">3. Utilisateurs mineurs</h3>
              <p>
                Les élèves mineurs ne peuvent s&apos;inscrire qu&apos;avec le consentement d&apos;un parent ou tuteur légal qui crée le compte parent.
                Le parent est responsable de l&apos;utilisation de la Plateforme par le mineur.
              </p>
            </section>

            {/* CGU 4 */}
            <section>
              <h3 className="text-xl font-bold mb-3 text-white">4. Obligations et interdictions</h3>
              <p className="mb-3">L&apos;Utilisateur s&apos;engage à :</p>
              <ul className="list-disc pl-5 space-y-1 mb-3">
                <li>Utiliser la Plateforme conformément à sa destination (usage éducatif)</li>
                <li>Ne pas tenter d&apos;accéder à des espaces non autorisés</li>
                <li>Ne pas diffuser de contenu illicite, diffamatoire ou portant atteinte aux droits de tiers</li>
                <li>Ne pas effectuer d&apos;extraction automatisée (scraping) du contenu</li>
                <li>Ne pas perturber le fonctionnement technique de la Plateforme</li>
              </ul>
              <p>
                Tout manquement peut entraîner la suspension ou la suppression du compte, sans préjudice des actions en justice éventuelles.
              </p>
            </section>

            {/* CGU 5 */}
            <section>
              <h3 className="text-xl font-bold mb-3 text-white">5. Disponibilité et maintenance</h3>
              <p>
                M&amp;M ACADEMY SUARL s&apos;efforce d&apos;assurer la disponibilité de la Plateforme 24h/24 et 7j/7.
                Toutefois, des interruptions (maintenance programmée, mises à jour, incidents techniques)
                pourront survenir sans engager la responsabilité de l&apos;éditeur. Les maintenances programmées seront,
                dans la mesure du possible, signalées à l&apos;avance.
              </p>
            </section>

            {/* CGU 6 */}
            <section>
              <h3 className="text-xl font-bold mb-3 text-white">6. Propriété intellectuelle</h3>
              <p>
                L&apos;ensemble des contenus de la Plateforme (textes, logiciels, design, bases de données, marques, logos,
                contenus pédagogiques, algorithmes IA) est la propriété exclusive de M&amp;M ACADEMY SUARL ou de ses licenciés.
                Toute reproduction, extraction ou diffusion non autorisée est strictement interdite.
              </p>
            </section>

            {/* CGU 7 */}
            <section>
              <h3 className="text-xl font-bold mb-3 text-white">7. Données personnelles</h3>
              <p>
                Le traitement des données personnelles est détaillé dans les{' '}
                <a href="/mentions-legales#donnees" className="text-brand-accent underline">Mentions Légales (section 7)</a>.
                Pour exercer vos droits (accès, rectification, suppression) : <a href="mailto:dpo@nexusreussite.academy" className="text-brand-accent underline">dpo@nexusreussite.academy</a>.
              </p>
            </section>

            {/* CGU 8 */}
            <section>
              <h3 className="text-xl font-bold mb-3 text-white">8. Droit applicable</h3>
              <p>
                Les présentes CGU sont régies par le <strong className="text-white">droit tunisien</strong>.
                Tout litige sera soumis aux <strong className="text-white">juridictions compétentes de Tunis</strong>,
                sous réserve des dispositions impératives de protection du consommateur applicables dans le pays de résidence de l&apos;Utilisateur.
              </p>
            </section>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* PARTIE II — CGV                                                */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="pt-4 border-t border-white/10">
              <h2 className="text-3xl font-bold mb-2 text-white">Partie II — Conditions Générales de Vente (CGV)</h2>
              <p className="text-neutral-400 text-sm mb-8">Applicables à toute commande passée sur la Plateforme.</p>
            </div>

            {/* CGV 1 */}
            <section>
              <h3 className="text-xl font-bold mb-3 text-white">1. Identité du Vendeur</h3>
              <ul className="space-y-1">
                <li><strong className="text-white">Vendeur :</strong> M&amp;M ACADEMY SUARL — Identifiant unique 1948837N</li>
                <li><strong className="text-white">Enseigne :</strong> Nexus Réussite</li>
                <li><strong className="text-white">Siège social :</strong> Immeuble VENUS, Appt C13, Centre Urbain Nord, 1082 Tunis, Tunisie</li>
                <li><strong className="text-white">Email :</strong>{' '}
                  <a href="mailto:contact@nexusreussite.academy" className="text-brand-accent underline">contact@nexusreussite.academy</a>
                </li>
                <li><strong className="text-white">Téléphone :</strong> +216 99 19 28 29</li>
              </ul>
            </section>

            {/* CGV 2 */}
            <section>
              <h3 className="text-xl font-bold mb-3 text-white">2. Offres et services</h3>
              <p className="mb-3">Le Vendeur propose :</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong className="text-white">Abonnements mensuels</strong> : Accès Plateforme, Hybride, Immersion (avec crédits de séances)</li>
                <li><strong className="text-white">Packs</strong> : Grand Oral, Parcoursup, Académie Intensive</li>
                <li><strong className="text-white">Add-ons IA « ARIA »</strong> : matières supplémentaires, accès premium</li>
              </ul>
              <p className="mt-3">
                Les caractéristiques essentielles de chaque offre (contenu, durée, crédits inclus) sont décrites
                sur la page <a href="/offres" className="text-brand-accent underline">Offres</a> et récapitulées avant paiement.
              </p>
            </section>

            {/* CGV 3 */}
            <section>
              <h3 className="text-xl font-bold mb-3 text-white">3. Formation du contrat</h3>
              <p>
                Le contrat est formé au moment de la <strong className="text-white">confirmation du paiement</strong> (validation ClicToPay ou déclaration de virement).
                Un récapitulatif de commande est présenté au Client avant paiement.
                L&apos;acceptation des présentes Conditions Générales est requise (case à cocher) avant toute transaction.
              </p>
            </section>

            {/* CGV 4 */}
            <section>
              <h3 className="text-xl font-bold mb-3 text-white">4. Prix et devise</h3>
              <p className="mb-3">
                Tous les prix sont indiqués en <strong className="text-white">Dinar Tunisien (TND)</strong>, toutes taxes comprises.
                Le prix applicable est celui affiché au moment de la validation de la commande.
              </p>
              <p>
                Le Vendeur se réserve le droit de modifier ses tarifs à tout moment.
                Les modifications ne s&apos;appliquent pas aux commandes déjà validées.
                Pour les abonnements en cours, toute modification tarifaire sera notifiée au moins 30 jours avant son entrée en vigueur.
              </p>
            </section>

            {/* CGV 5 */}
            <section>
              <h3 className="text-xl font-bold mb-3 text-white">5. Paiement</h3>
              <h4 className="font-semibold text-white mt-3 mb-2">5.1 Modes de paiement acceptés</h4>
              <ul className="list-disc pl-5 space-y-1 mb-3">
                <li><strong className="text-white">Carte bancaire via ClicToPay</strong> (Banque Zitouna) — cartes nationales et internationales</li>
                <li><strong className="text-white">Virement bancaire</strong> sur le compte Banque Zitouna de M&amp;M ACADEMY SUARL</li>
              </ul>

              <h4 className="font-semibold text-white mt-4 mb-2">5.2 Sécurité des transactions</h4>
              <ul className="list-disc pl-5 space-y-1 mb-3">
                <li>Les paiements par carte sont sécurisés par <strong className="text-white">CVV2</strong> et <strong className="text-white">3D Secure</strong>.</li>
                <li>Le <strong className="text-white">cryptogramme visuel (CVV/CVC) n&apos;est jamais stocké</strong> par le Vendeur — ni en base de données, ni dans les journaux techniques.</li>
                <li>Toutes les données de carte sont traitées exclusivement par le prestataire de paiement ClicToPay dans un environnement sécurisé.</li>
              </ul>

              <h4 className="font-semibold text-white mt-4 mb-2">5.3 Absence de frais additionnels</h4>
              <p className="mb-3">
                <strong className="text-white">Aucun frais additionnel</strong> n&apos;est facturé au Client du seul fait du paiement par carte bancaire.
                Le montant débité correspond exactement au prix affiché.
              </p>

              <h4 className="font-semibold text-white mt-4 mb-2">5.4 Virement bancaire</h4>
              <p>
                En cas de paiement par virement, le Client déclare son virement sur la Plateforme.
                Le service est activé après <strong className="text-white">vérification et validation</strong> du virement par l&apos;équipe administrative (délai indicatif : 24 à 48 heures ouvrées).
              </p>
            </section>

            {/* CGV 6 */}
            <section>
              <h3 className="text-xl font-bold mb-3 text-white">6. Accès et délivrance du service</h3>
              <p className="mb-3">
                Après validation du paiement :
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>L&apos;abonnement ou le pack est activé automatiquement sur le compte de l&apos;élève.</li>
                <li>Un email de confirmation est envoyé au Parent avec le détail des services activés.</li>
                <li>Une facture PDF est générée et consultable dans le coffre-fort numérique du compte parent.</li>
              </ul>
            </section>

            {/* CGV 7 */}
            <section>
              <h3 className="text-xl font-bold mb-3 text-white">7. Annulation, report et absence (no-show)</h3>
              <h4 className="font-semibold text-white mt-3 mb-2">7.1 Séances individuelles (crédits)</h4>
              <ul className="list-disc pl-5 space-y-1 mb-3">
                <li><strong className="text-white">Annulation ou report :</strong> possible jusqu&apos;à <strong className="text-white">24 heures</strong> avant l&apos;heure prévue de la séance, sans pénalité.</li>
                <li><strong className="text-white">Annulation tardive (&lt; 24h) ou absence (no-show) :</strong> le crédit de séance est considéré comme consommé.</li>
              </ul>

              <h4 className="font-semibold text-white mt-4 mb-2">7.2 Abonnements</h4>
              <p className="mb-3">
                Les abonnements mensuels sont résiliables à tout moment via le tableau de bord parent.
                La résiliation prend effet à la fin de la période mensuelle en cours. Les crédits non consommés ne sont pas reportés sur la période suivante.
              </p>

              <h4 className="font-semibold text-white mt-4 mb-2">7.3 Annulation par le Vendeur</h4>
              <p>
                En cas d&apos;annulation d&apos;une séance par le Vendeur (indisponibilité du coach), le crédit est automatiquement restitué au compte de l&apos;élève. Un report est proposé prioritairement.
              </p>
            </section>

            {/* CGV 8 */}
            <section>
              <h3 className="text-xl font-bold mb-3 text-white">8. Remboursements</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong className="text-white">Abonnements :</strong> aucun remboursement prorata pour les jours restants du mois en cours après résiliation.</li>
                <li><strong className="text-white">Packs :</strong> remboursement intégral si la demande est formulée dans les 14 jours suivant l&apos;achat et qu&apos;aucune séance n&apos;a été consommée.</li>
                <li><strong className="text-white">Incident technique :</strong> si un service payé n&apos;a pas pu être délivré du fait du Vendeur, un remboursement ou un avoir est accordé.</li>
              </ul>
              <p className="mt-3">
                Les demandes de remboursement doivent être adressées à{' '}
                <a href="mailto:contact@nexusreussite.academy" className="text-brand-accent underline">contact@nexusreussite.academy</a>{' '}
                en indiquant le motif et la référence de commande. Délai de traitement : 10 jours ouvrés maximum.
              </p>
            </section>

            {/* CGV 9 */}
            <section>
              <h3 className="text-xl font-bold mb-3 text-white">9. Droit de rétractation (clause prudente)</h3>
              <p className="mb-3">
                Le droit de rétractation de 14 jours prévu par certaines législations de protection du consommateur peut être limité
                pour les services numériques dont l&apos;exécution commence immédiatement après le paiement avec le consentement exprès du Client.
              </p>
              <p className="mb-3">
                Si le Client demande l&apos;exécution immédiate du service ou de l&apos;accès numérique (case optionnelle au moment du paiement),
                il reconnaît renoncer à son droit de rétractation pour la partie du service déjà exécutée.
              </p>
              <p className="text-sm text-neutral-400">
                Si les dispositions impératives de protection du consommateur du pays de résidence du Client prévoient un droit de rétractation plus favorable,
                ces dispositions s&apos;appliquent de plein droit.
              </p>
            </section>

            {/* CGV 10 */}
            <section>
              <h3 className="text-xl font-bold mb-3 text-white">10. Réclamations et support</h3>
              <p>
                Pour toute réclamation relative à une commande ou à l&apos;exécution d&apos;un service, le Client peut contacter :
              </p>
              <ul className="mt-3 space-y-1">
                <li><strong className="text-white">Email :</strong>{' '}
                  <a href="mailto:contact@nexusreussite.academy" className="text-brand-accent underline">contact@nexusreussite.academy</a>
                </li>
                <li><strong className="text-white">Téléphone :</strong> +216 99 19 28 29</li>
              </ul>
              <p className="mt-3">
                Le Vendeur s&apos;engage à accuser réception de toute réclamation dans un délai de 48 heures ouvrées
                et à apporter une réponse dans un délai raisonnable (maximum 30 jours).
              </p>
            </section>

            {/* CGV 11 */}
            <section>
              <h3 className="text-xl font-bold mb-3 text-white">11. Propriété intellectuelle des contenus pédagogiques</h3>
              <p>
                Les contenus pédagogiques (cours, exercices, corrections, ressources IA) mis à disposition dans le cadre des services souscrits
                sont concédés en <strong className="text-white">licence d&apos;utilisation personnelle et non transférable</strong>.
                Toute reproduction, partage ou revente est strictement interdit.
              </p>
            </section>

            {/* CGV 12 */}
            <section>
              <h3 className="text-xl font-bold mb-3 text-white">12. Sécurité et confidentialité</h3>
              <p>
                Le Vendeur met en œuvre des mesures de sécurité raisonnables (chiffrement TLS, hachage des mots de passe,
                contrôle d&apos;accès par rôle) pour protéger les données des utilisateurs.
                Le Client est tenu de préserver la confidentialité de ses identifiants.
              </p>
            </section>

            {/* CGV 13 */}
            <section>
              <h3 className="text-xl font-bold mb-3 text-white">13. Limitation de responsabilité</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Le Vendeur est soumis à une <strong className="text-white">obligation de moyens</strong> dans la fourniture de ses services.</li>
                <li>Le Vendeur ne garantit pas l&apos;obtention de résultats scolaires spécifiques.</li>
                <li>La responsabilité du Vendeur est limitée au montant effectivement payé par le Client pour le service concerné.</li>
                <li>Le Vendeur ne saurait être tenu responsable de dommages indirects (perte de données, perte de chance, manque à gagner).</li>
              </ul>
            </section>

            {/* CGV 14 */}
            <section>
              <h3 className="text-xl font-bold mb-3 text-white">14. Force majeure</h3>
              <p>
                Le Vendeur ne pourra être tenu responsable de l&apos;inexécution de ses obligations en cas de force majeure
                au sens de la législation tunisienne (catastrophe naturelle, pandémie, décision gouvernementale,
                panne d&apos;infrastructure Internet ou électrique généralisée, etc.).
                En cas de force majeure persistant au-delà de 30 jours, chaque partie pourra résilier le contrat de plein droit.
              </p>
            </section>

            {/* CGV 15 */}
            <section>
              <h3 className="text-xl font-bold mb-3 text-white">15. Modification des Conditions Générales</h3>
              <p>
                Le Vendeur se réserve le droit de modifier les présentes Conditions Générales à tout moment.
                Les modifications seront publiées sur cette page avec une nouvelle date d&apos;entrée en vigueur et un nouveau numéro de version.
                Pour les abonnements en cours, les modifications substantielles seront notifiées par email au moins 30 jours avant leur entrée en vigueur.
                La poursuite de l&apos;utilisation de la Plateforme après la date d&apos;effet vaut acceptation des nouvelles conditions.
              </p>
            </section>

            {/* CGV 16 */}
            <section>
              <h3 className="text-xl font-bold mb-3 text-white">16. Droit applicable et juridiction</h3>
              <p className="mb-3">
                Les présentes Conditions Générales sont régies par le <strong className="text-white">droit tunisien</strong>.
                Tout litige relatif à l&apos;interprétation ou à l&apos;exécution des présentes sera soumis aux <strong className="text-white">juridictions compétentes de Tunis, Tunisie</strong>.
              </p>
              <p className="text-sm text-neutral-400">
                Sous réserve des dispositions impératives de protection du consommateur applicables dans le pays de résidence du Client.
                En cas de litige, une tentative de règlement amiable sera recherchée préalablement à toute action judiciaire.
              </p>
            </section>

            {/* Date & version */}
            <div className="pt-6 border-t border-white/10 text-sm text-neutral-400">
              <p>Version {CGV_VERSION} — Date d&apos;effet : 1er mars 2026</p>
              <p>Dernière mise à jour : 1er mars 2026</p>
            </div>
          </div>
        </div>
      </main>

      <CorporateFooter />
    </div>
  );
}
