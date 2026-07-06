# Triage montants TND hors pricing canonique

Date locale : 2026-07-02 18:20 CET

## Commandes

| Statut | Objectif | Commande exacte | Résultat |
| --- | --- | --- | --- |
| PARTIEL | Rechercher montants et textes tarifaires | `rg -n "TND|DT|dès [0-9]|[0-9][0-9][0-9]\\s*TND|[0-9][0-9][0-9]\\s*DT|prix|tarif|montant" app components data lib content docs --glob '!docs/archive/**'` | Nombreuses occurrences ; plusieurs faux positifs docs, pédagogie, dashboards et sources canoniques. |
| OK | Vérifier le guard officiel | `npm run check:no-hardcoded` | OK : 0 hardcoded values outside canonical sources. |

## Classification principale

| Fichier / zone | Classification | Preuve | Décision Lot 0-bis |
| --- | --- | --- | --- |
| `data/pricing.canonical.json` | CANONIQUE | Source de vérité déclarée ; contient `currency`, offres, crédits opérationnels, repères. | OK. |
| `data/pricing-client-data.generated.json` | DÉRIVÉE DU PRICING | Fichier généré depuis le canonique pour le client. | OK si régénéré après tout changement pricing. |
| `app/HomePageClient.tsx` | DÉRIVÉE DU PRICING | Utilise `getReperesTarifaires()` depuis `lib/pricing-client`. | OK. |
| `app/offres/page.tsx` et `components/marketing/OfferDetailDialog.tsx` | DÉRIVÉE DU PRICING | Affichage via `fmtTND`, `getRules()`, `getAllOffers()` et données offre. | OK local. |
| `components/marketing/LandingNiche.tsx` | DÉRIVÉE DU PRICING | Prix formatés via `fmtTND(offer.price)`. | OK local, vérifier source des offres landings en Lot 2. |
| `data/Nexus_Reussite_Accueil.html` | ARCHIVE MORTE dans `data/` | Aucune importation runtime trouvée ; contient anciens repères `220`, `250`, `290`, `490`, `390`, `720`, stage `350 TND`. | Ne pas utiliser comme source ; garder P1 de nettoyage/archivage. |
| `Nexus_Reussite_Accueil.html` racine | FICHIER ACTIVABLE / DETTE À CORRIGER | `next.config.mjs` l'inclut dans `outputFileTracingIncludes`; le fichier contient liens et anciens repères HTML. | P1 : retirer du tracing ou archiver proprement après vérification production/Nginx. |
| `components/ui/specialized-packs.tsx` | FICHIER ACTIVABLE / DETTE À CORRIGER | Non importé par `rg`, mais exporte un composant avec `300 TND`, `1200 TND`, `450 TND`. | P1 Lot 2 : migrer vers pricing canonique ou archiver le composant. |
| `app/dashboard/parent/abonnements/page.tsx` | DÉRIVÉE DU PRICING | Prix venant de `getOperationalSubscriptionPlans()`, `getAriaAddonCatalog()`, `getSpecialPackCatalog()`. | OK. |
| `app/dashboard/assistante/subscriptions/page.tsx` | DÉRIVÉE DU PRICING / runtime DB | Affiche prix catalogue ou champs subscription existants. | À couvrir dans Lot 4/5. |
| `app/dashboard/admin/facturation/page.tsx` | FICHIER ACTIVABLE | Montants saisis par admin et presets facture ; conversion millimes. | Hors pricing public ; audit facturation Lot 4. |
| `docs/incidents/*`, `docs/audits/*` | ARCHIVE / DOCUMENTATION HISTORIQUE | Montants de tests ou rapports datés. | Faux positifs runtime, ne pas traiter comme source commerciale. |
| `data/automatismes/*`, `content/stage-eam-stmg/*`, `components/EAMPrep/*` | FAUX POSITIF | Exercices pédagogiques sur prix en euros ou variables. | OK. |
| `lib/email.ts` | DÉRIVÉE D'ARGUMENT | Affiche `${price} TND`; le montant est fourni par l'appelant. | Vérifier appelants en Lot 4/CRM. |

## Limites du guard actuel

- `scripts/check-no-hardcoded.sh` passe, mais sa recherche TND client repose sur une expression `grep` avec `\s`, peu robuste en basic regex.
- Le script ne couvre pas la racine ni `data/`.
- Le script ne détecte pas les composants exportés mais non importés si la regex ne matche pas selon le grep local.

## Action recommandée

- Lot 2 : corriger ou archiver `components/ui/specialized-packs.tsx`.
- Lot 2/8 : vérifier si `Nexus_Reussite_Accueil.html` racine peut être servi en production ; retirer du tracing standalone si obsolète.
- Lot 2 : renforcer `check:no-hardcoded` après classification des exceptions pour éviter de transformer une dette connue en build rouge non exploitable.
