# Implémentation de la landing Pré-rentrée 2026

## Date

12 juillet 2026

## Contexte

La campagne urgente Pré-rentrée 2026 repose sur le contrat validé au SHA
`8db358926bc511fc98bb0882dea4a9b8ba2ba837`. La production publique retournait 404
sur `/stages/pre-rentree-2026` et `/pre-rentree` au début du contrôle. Aucun
déploiement n'a été effectué pendant cette livraison.

## Problèmes observés

- Le worktree cible existait déjà avec quinze commits propres au-dessus du contrat.
- Le typecheck du worktree contractuel échouait dans le test de synchronisation du
  calendrier sur `pack_product_ids`; la branche landing corrige ce défaut.
- Le numéro fictif `21620123456` était présent dans le contrat initial; il a été
  remplacé par le canal `WHATSAPP_PRIMARY`, les liens utilisant `buildWhatsAppUrl()`.
- Le résumé exposait les enums techniques des profils et du statut.
- Les cartes matière n'affichaient pas leur résumé pédagogique.
- La bulle WhatsApp desktop globale masquait une partie des programmes et de la FAQ.
- Deux barres mobiles pouvaient se superposer sur les pages publiques.
- Le contrôle générique des périodes de stage classait le nom contractuel exact de
  la campagne comme un montant ou calendrier local non canonique.

## Décisions prises

- La page serveur appelle uniquement `getPreRentreeLandingDTO()` pour ses données.
- Le DTO valide le manifeste et les modules, puis résout les quatre packs avec
  `lib/pricing.ts`; aucun montant n'est copié dans le manifeste ou les composants.
- Les résumés pédagogiques des cartes sont dérivés des sous-titres des modules dans
  le getter, sans nouvelle source de contenu.
- Les libellés de profils visibles sont dérivés des options du DTO, tandis que les
  identifiants normalisés restent utilisés dans l'URL validée.
- La barre mobile historique porte le lien campagne, se masque au focus et au
  footer, respecte la safe area et est désactivée sur la landing et le bilan.
- La bulle desktop globale est désactivée sur la landing, qui possède ses propres
  CTA WhatsApp contextuels.
- L'exception anti-hardcode autorise uniquement le nom exact `Pré-rentrée 2026`
  sur une liste explicite de surfaces campagne. Les contrôles de montants, dates
  ISO, numéros et imports JSON restent inchangés.

## Fichiers modifiés

La livraison complète crée la route canonique, la redirection, les composants de
campagne, la logique pure, le parseur de préremplissage, les tests et les contenus
contractuels. Les derniers correctifs de revue concernent notamment :

- `components/pre-rentree-2026/StageConfigurator.tsx`
- `lib/campaigns/pre-rentree-2026/configurator.ts`
- `lib/campaigns/pre-rentree-2026/getters.ts`
- `components/marketing/MobileStickyBar.tsx`
- `components/marketing/acadomia-inspired.tsx`
- `components/layout/CorporateNavbar.tsx`
- `e2e/pre-rentree-2026.spec.ts`
- `scripts/check-no-hardcoded.sh`
- les tests campagne et composants associés.

## Tests exécutés

- `npm ci` : code 0, 1 194 paquets installés.
- `PERF_TESTS=1 npm run test -- --runInBand` : 531 suites, 6 620 tests,
  aucun échec et aucun skip.
- `npm run typecheck` : code 0.
- `npm run lint` : code 0; avertissements historiques hors périmètre.
- `npm run build` : code 0; route statique
  `/stages/pre-rentree-2026`, 9,55 kB, 137 kB First Load JS.
- Playwright avec une variable `NEXTAUTH_SECRET` locale et éphémère :
  `npx playwright test e2e/pre-rentree-2026.spec.ts --project=chromium` :
  9 tests réussis.
- `npm run audit:site-map` : code 0, aucun lien invalide détecté.
- `npm run check:no-hardcoded` : code 0.
- `npm run security:repo` : code 0.
- audit HTTP local : `/`, `/offres`, `/stages`, `/bilan-gratuit` et la route
  canonique répondent 200; `/pre-rentree` répond 308 vers la route canonique.
- `git diff --check` : code 0.

## Résultats

- 12 modules : 6 par semaine.
- 60 séances de deux heures sur 10 jours de cours.
- Aucun cours les 22 et 23 août; aucune collision salle/bloc.
- Quatre packs canoniques; aucun champ monétaire numérique dans le manifeste.
- Aucun numéro fictif ou numéro WhatsApp dans les composants campagne.
- Aucun prix, import pricing JSON ou import manifeste JSON dans les composants.
- Le bilan accepte uniquement les paramètres autorisés et ignore tout prix URL.
- La landing reste statique et fonctionne sans connexion ni base de données.

## Captures non commitées

Répertoire : `/tmp/nexus-pre-rentree-2026-evidence`

- `desktop-1440x1000.png`
- `tablet-768x1024.png`
- `mobile-390x844.png`
- `mobile-320x800.png`
- `hero.png`
- `configurator-empty.png`
- `configurator-two-subjects.png`
- `configurator-four-subjects.png`
- `planning-seconde.png`
- `planning-première.png`
- `planning-terminale.png`
- `program-open.png`
- `faq.png`
- `final-cta.png`

## Risques restants

- `npm ci` signale 24 vulnérabilités de dépendances déjà présentes
  (3 faibles, 9 modérées, 12 élevées); aucune mise à jour forcée n'a été appliquée.
- Le lint global sort avec des avertissements historiques hors périmètre, mais aucun
  avertissement n'est introduit dans les fichiers campagne contrôlés.
- Le serveur standalone journalise un échec non bloquant de rafraîchissement passif
  de configuration lorsque la base E2E n'est pas lancée; la landing répond néanmoins
  200 et ses tests n'utilisent pas la base.
- Les coûts enseignant, salle, matériel, administration, acquisition et marge restent
  `OWNER_INPUT_REQUIRED`; le paiement et la confirmation automatique restent fermés.

## Rollback

Revenir aux commits de cette branche dans l'ordre inverse. Le contrat de campagne
au SHA `8db358926bc511fc98bb0882dea4a9b8ba2ba837` reste la base de repli. Aucun rollback
de base de données, Prisma, migration ou paiement n'est nécessaire.
