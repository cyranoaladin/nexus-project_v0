# Décisions métier à figer

## Source de vérité pricing

- Décision proposée : `data/pricing.canonical.json` reste source unique ; accès via `lib/pricing.ts` côté serveur et `lib/pricing-client.ts` côté client.
- Raison : AGENTS.md et code actuel convergent sur cette règle.
- Fichiers impactés : `data/pricing.canonical.json`, `lib/pricing.ts`, `lib/pricing-client.ts`, pages publiques.
- Test attendu : `npm run check:no-hardcoded`, tests pricing.
- Validation humaine requise : Non, sauf changement d'offre.

## Prix stage affiché

- Décision proposée : utiliser exclusivement les formats de `stage_formats`; prix de base observé `express-vacances` à 420 TND.
- Raison : audit racine signale l'ancien 350 TND comme obsolète ; canonique 2026/2027 expose 420 TND.
- Fichiers impactés : `app/stages/*`, `app/offres/page.tsx`, archives.
- Test attendu : recherche `TND`, `npm run check:no-hardcoded`.
- Validation humaine requise : Oui pour valider commercialement les formats.

## Promesse groupe maximum

- Décision proposée : promettre `groupes de 5 maximum` quand dérivé de `rules.group_max`.
- Raison : `data/pricing.canonical.json` indique `group_max: 5`; pages inspectées l'utilisent.
- Fichiers impactés : pages marketing, `content/marketing/*`.
- Test attendu : guard texte vs `getRules().group_max`.
- Validation humaine requise : Oui pour capacité opérationnelle réelle.

## Statut des candidats libres

- Décision proposée : maintenir une niche claire candidat libre avec offres dédiées et prudence administrative.
- Raison : `/candidat-libre-bac-francais` et `content/marketing/seo-landings.ts` couvrent le statut sans se substituer à Cyclades/IFT.
- Fichiers impactés : `content/marketing/seo-landings.ts`, `/offres`, `/bilan-gratuit`.
- Test attendu : smoke landing + liens offres existants.
- Validation humaine requise : Oui pour conformité session 2027.

## Rôle de la Carte Nexus

- Décision proposée : la Carte Nexus est un droit/avantage produit à expliciter dans le catalogue canonique, pas une promesse générale.
- Raison : le pricing doit rester source produit.
- Fichiers impactés : `data/pricing.canonical.json`, `app/offres/page.tsx`.
- Test attendu : affichage catalogue sans hardcode.
- Validation humaine requise : Oui.

## Rôle du bilan gratuit

- Décision proposée : adopter l'Option C : `lead_only` pour campagnes et `account_activation` après validation humaine ou inscription confirmée.
- Raison : UI actuelle ne demande pas de mot de passe, mais `app/api/bilan-gratuit/route.ts` crée `User` parent, `ParentProfile`, `User` élève, `Student`, token d'activation et email d'activation. Pour Meta Ads, cette création implicite n'est pas alignée avec la promesse lead bas-friction.
- Fichiers impactés : `app/bilan-gratuit/*`, `app/api/bilan-gratuit/route.ts`, CRM.
- Test attendu : soumission lead en mode campagne sans création de compte, activation différée testée, consentement explicite.
- Validation humaine requise : Oui.

## Paiement manuel vs ClicToPay

- Décision proposée : virement manuel autorisé en bêta contrôlée ; ClicToPay reste désactivé et masqué du public tant que `501`.
- Raison : code ClicToPay non configuré ; Lot 0-bis masque la mention publique via `PaymentMethodsNote` sauf opt-in `NEXT_PUBLIC_ENABLE_CLICTOPAY_PUBLIC=true`.
- Fichiers impactés : `app/api/payments/*`, dashboards paiement, `components/marketing/PaymentMethodsNote.tsx`.
- Test attendu : paiement manuel complet, ClicToPay non proposé publiquement, ClicToPay 501 assumé côté API.
- Validation humaine requise : Oui.

## Source de vérité des droits produit

- Décision proposée : cible = `Invoice` payée + `InvoiceItem.productCode` + `Entitlement`; `Subscription` et crédits legacy deviennent projections.
- Raison : `activateEntitlements` existe mais coexistence legacy crée risque ; Lot 0-bis confirme un écart pricing/entitlement 0/4/8 vs 4/8/16 crédits.
- Fichiers impactés : `lib/entitlement/*`, `app/api/payments/validate/route.ts`, `prisma/schema.prisma`.
- Test attendu : test contrat pricing -> entitlement.
- Validation humaine requise : Oui.

## Consentement analytics

- Décision proposée : GA reste désactivé par défaut ; ne pas activer `NEXT_PUBLIC_ENABLE_GOOGLE_ANALYTICS=true` sans CMP/consent mode.
- Raison : aucun composant de consentement analytics n'a été trouvé ; `app/layout.tsx` ne charge plus GA sauf opt-in explicite.
- Fichiers impactés : `app/layout.tsx`, `lib/analytics.ts`, `app/politique-confidentialite/page.tsx`.
- Test attendu : HTML initial sans `googletagmanager.com/gtag/js` tant que pas de consentement.
- Validation humaine requise : Oui avant campagne paid.

## Runtime Node de validation

- Décision proposée : considérer Node 20 comme runtime de référence local/CI/Docker pour les validations go-live.
- Raison : `.github/workflows/ci.yml` cible `20.x`, `Dockerfile.prod` utilise `node:20-alpine`, alors que le shell local par défaut est Node `v22.21.0`. `nvm use 20.20.0` est disponible.
- Fichiers impactés : `.github/workflows/ci.yml`, `Dockerfile.prod`, `package.json`, documentation QA.
- Test attendu : typecheck, build et smoke public sous Node 20.
- Validation humaine requise : Non.

## Statut de la plateforme ARIA

- Décision proposée : ARIA complète l'accompagnement humain et dépend des formules/add-ons.
- Raison : pages inspectées reprennent cette prudence.
- Fichiers impactés : `/plateforme-aria`, `/offres`, `app/api/aria/*`.
- Test attendu : feature guard, copy sans surpromesse.
- Validation humaine requise : Oui pour offres ARIA.

## Statut de NPC

- Décision proposée : NPC est bêta interne/coach tant que `NPC_LLM_MODE` n'est pas validé `live`.
- Raison : défaut code à `stub`.
- Fichiers impactés : `lib/npc/*`, `services/npc-worker/*`, dashboards NPC.
- Test attendu : affichage mode, worker live/stub/off.
- Validation humaine requise : Oui.

## Statut des stages de prérentrée

- Décision proposée : prérentrée août 2026 du 24 au 28 août affichable si validée commercialement ; dates précises autres vacances communiquées selon niveau/formule.
- Raison : `stage_calendar` canonique contient `pre-rentree-2026`.
- Fichiers impactés : `data/pricing.canonical.json`, `app/stages/*`.
- Test attendu : page stages + no dates obsolètes printemps 2026.
- Validation humaine requise : Oui.

## Promesse marketing autorisée

- Décision proposée : groupes réduits, méthode structurée, bilan individualisé, suivi parent, enseignants qualifiés, progression mesurable, cadre exigeant.
- Raison : conforme AGENTS.md et audit.
- Fichiers impactés : toutes pages publiques.
- Test attendu : recherche promesses interdites.
- Validation humaine requise : Non pour principe, Oui pour preuves enseignants.

## Promesses interdites

- Décision proposée : interdire garantie réussite, 100 % bac ou remboursé, garantie mention, taux non sourcé, chiffres élèves/mentions non prouvés.
- Raison : risque juridique et crédibilité.
- Fichiers impactés : pages marketing, archives, emails.
- Test attendu : recherche `garantie`, `100 %`, `mention`, `remboursé` contextualisée.
- Validation humaine requise : Non.
