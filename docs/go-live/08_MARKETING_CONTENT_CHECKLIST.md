# Checklist marketing et contenu

## Prix affichés

- Statut : PARTIEL OK.
- Preuve : `/offres`, `/stages`, `/recommandation`, landings SEO utilisent pricing/getters ou contenu centralisé.
- Risque : `data/Nexus_Reussite_Accueil.html` est archive morte avec anciens montants ; `Nexus_Reussite_Accueil.html` racine est encore inclus dans le tracing standalone ; `components/ui/specialized-packs.tsx` est exporté mais non importé avec prix hardcodés.
- Action : Lot 2 doit migrer/archiver les composants activables et vérifier exposition production du HTML racine.

## Offres annuelles

- Statut : OK local.
- Preuve : `data/pricing.canonical.json` version `2026-2027.1`; `/offres` affiche catalogue 2026/2027.
- Action : validation commerciale humaine avant campagne.

## Stages prérentrée août 2026

- Statut : OK local.
- Preuve : `stage_calendar` contient `pre-rentree-2026` du 24 au 28 août 2026 ; `/stages` build OK.
- Action : confirmer capacité opérationnelle et wording des dates non confirmées.

## Candidat libre

- Statut : OK local, à valider juridiquement.
- Preuve : `/candidat-libre-bac-francais` utilise `content/marketing/seo-landings.ts`; offres libres existent dans pricing.
- Action : vérifier textes session 2027 et mentions Cyclades/IFT.

## Groupe maximum

- Statut : OK local.
- Preuve : `rules.group_max` = 5 ; pages inspectées utilisent ce repère.
- Action : ajouter guard global si nécessaire.

## WhatsApp

- Statut : OK local.
- Preuve : `lib/whatsapp.ts` centralise `https://wa.me/21699192829`; smoke Lot 0-bis vérifie liens desktop/mobile accessibles.
- Action : vérifier tracking/UTM et message prérempli.

## Bilan gratuit

- Statut : PARTIEL / bloquant campagne paid.
- Preuve : UI sans mot de passe et validations Playwright OK ; API crée comptes parent/élève inactifs, token et email d'activation.
- Action : recommander Option C `lead_only` pour campagne et `account_activation` après validation humaine ; ajouter UTM/source/referrer.

## Mentions légales

- Statut : À vérifier production.
- Preuve : `lib/legal.ts` centralise identité, siège administratif et centre pédagogique.
- Action : vérifier RNE, politique commerciale et conformité.

## Politique confidentialité

- Statut : À renforcer.
- Preuve : page existe dans site map ; GA est désormais désactivé par défaut, mais la politique ne décrit pas encore une CMP/consent mode complet.
- Action : ajouter consentement analytics et traitements mineurs.

## Consentement analytics

- Statut : P0 partiellement verrouillé.
- Preuve : `app/layout.tsx` ne charge GA que si `NEXT_PUBLIC_ENABLE_GOOGLE_ANALYTICS=true` et `NEXT_PUBLIC_GA_MEASUREMENT_ID` existe ; aucune CMP complète trouvée.
- Action : garder GA désactivé ; consent mode/CMP avant tout tracking non essentiel.

## Meta Pixel éventuel

- Statut : Non détecté localement.
- Preuve : recherche `fbq`, `facebook.net`, `Meta Pixel` sans intégration active.
- Action : interdire sans consentement.

## Témoignages

- Statut : À vérifier.
- Preuve : pas d'audit exhaustif contenu témoignages Lot 0.
- Action : supprimer chiffres/témoignages non sourcés.

## Pages SEO

- Statut : OK partiel.
- Preuve : `npm run audit:site-map` : 0 link finding ; landings SEO buildent.
- Action : traiter 13 public orphan entries si pertinent.

## CTA

- Statut : OK partiel.
- Preuve : pages critiques CTA bilan/offres/WhatsApp.
- Action : éviter `sécuriser` si perçu comme garantie ; préférer demander bilan, trouver formule, être conseillé.

## Cohérence Nexus premium

- Statut : OK partiel.
- Preuve : direction visuelle commune sur pages inspectées.
- Action : harmoniser reliquats `lux-*`, `marketing-*`, `brand-*`, `surface-*`, `nexus-*` en P1.

## Incohérences probables

- Site public Next.js : plutôt aligné 2026/2027.
- Pricing canonique : solide mais doit être relié au registre entitlement.
- Anciens fichiers HTML : contiennent prix/mois et stage 350 TND obsolètes ; racine encore à vérifier côté exposition production.
- Documents marketing : à inventorier avant campagne.
- Textes de campagne : à relire pour promesses interdites et consentement tracking.
