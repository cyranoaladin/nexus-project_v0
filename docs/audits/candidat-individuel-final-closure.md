# Clôture structurelle Candidat Individuel

## Date

23 août 2026

## Contexte

Cette note documente les décisions de portée prises pendant la recette finale
de la refonte Candidat Individuel. Elle ne contient aucune donnée ni procédure
de production.

## Décisions prises

- `/api/quotes/public/[token]` est un contrat HTTP familial directement
  adressable. Comme toute API, son accessibilité ne dépend pas d'un import
  JavaScript interne. La page HTML `/devis/[token]` et ce contrat partagent le
  même service de lecture et la même transition atomique de consultation.
- `/api/diagnostics/candidat-libre/consent` reste un contrat HTTP protégé du
  diagnostic candidat libre. Le portail complet reste une fonctionnalité sombre
  contrôlée par feature flag et allowlist ; son ouverture et l'arbitrage final
  du texte de consentement ne font pas partie de cette release devis.
- Les branches applicatives de révision de devis sans écrivain ont été retirées.
  Les colonnes Prisma déjà créées par la migration additive restent mappées :
  les supprimer imposerait une migration destructive hors périmètre.
- Les qualificatifs tarifaires, volumes annuels et clauses Grand Oral affichés
  par le catalogue, la recommandation et le PDF restent issus du catalogue
  canonique. L'Intégrale est un plafond de 300 h incluant le Grand Oral ; le
  Focus Bac distingue ses 200 h régulières de l'enveloppe Grand Oral.
- La création publique du lead, de son intention de notification et du devis
  est atomique. Un rejeu concurrent perdant est entièrement annulé ; un rejeu
  détecté est rejeté sans associer l'identité d'un devis persistant à un
  scénario recalculé.
- L'espace assistante fige le lead et consomme le scénario, la situation et la
  validité renvoyés par le serveur avant de produire le PDF. Une modification
  postérieure des champs du workspace ne peut plus altérer ce document.

## Fichiers modifiés

Le service de lecture familiale, la persistance de consultation, les projections
devis, les surfaces publiques du catalogue et de recommandation, l'adaptateur
PDF, la transaction de création lead/devis, les gardes d'architecture et les
tests associés.

## Tests exécutés

Tests unitaires ciblés, tests PostgreSQL jetable, TypeScript, lint, build et E2E
devis. Les résultats exacts sont consignés dans le rapport de release.

## Risques restants

L'ouverture du diagnostic sombre devra faire l'objet d'une recette juridique et
pédagogique distincte avant activation globale.

## Rollback

Le rollback applicatif consiste à revenir au SHA précédent. La migration Quote
est additive ; aucun downgrade destructif n'est prévu.
