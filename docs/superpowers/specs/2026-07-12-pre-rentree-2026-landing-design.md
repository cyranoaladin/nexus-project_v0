# Pré-rentrée 2026 Landing Design

## Contexte

La branche de campagne fournit un manifeste validé, douze modules pédagogiques et quatre identifiants de packs reliés au catalogue canonique. La landing publique doit rester statique, sans base de données ni paiement, tout en permettant une configuration fiable et un transfert strictement validé vers le bilan gratuit.

Le worktree de livraison contenait déjà quatre commits partiels au début de cette session. Ce document fixe l'architecture cible utilisée pour auditer puis compléter ce travail sans réécrire les sources contractuelles.

## Architecture

- `getPreRentreeLandingDTO()` est l'unique façade serveur de la page. Il valide le manifeste et les modules, résout les packs via `lib/pricing.ts`, puis retourne un DTO sérialisable contenant tous les textes, profils, horaires, programmes, conditions, FAQ et métadonnées nécessaires.
- La page serveur ne lit aucun JSON et ne contient aucune valeur métier de campagne. Elle produit les métadonnées et le JSON-LD à partir du DTO, puis distribue des sous-ensembles du DTO aux sections.
- La logique du configurateur est isolée dans un module TypeScript pur : sélection de pack, navigation, validation de profil, résumé, paramètres de bilan et message WhatsApp. Les composants clients ne recalculent aucun montant.
- Le bilan gratuit dispose d'un parseur serveur strict. Seuls le programme, le pack, le niveau, les codes matière et les codes de profil autorisés traversent l'URL. Aucun prix ni texte libre n'est accepté.
- Les interactions utilisent le système `track` existant à travers une surface typée, limitée aux propriétés analytics contractuelles et dépourvue de PII.

## Composants

- Sections serveur : hero, faits clés, tarifs, méthode, informations pratiques, CTA final et données structurées.
- Îlots clients : configurateur, planning à deux vues, programmes filtrables, FAQ et suivi de page unique.
- Le résumé est sticky dans la grille desktop et devient un panneau repliable avec espace réservé et safe area sur mobile.
- Les contenus contractuels résident dans le manifeste ou les modules ; les composants ne contiennent que des libellés UI génériques.

## Flux de conversion

1. Le parent sélectionne un niveau, puis un profil lorsque nécessaire.
2. Il choisit une à quatre matières disponibles pour ce niveau.
3. La logique pure sélectionne le pack canonique correspondant et agrège séances, heures, jours et horaires depuis le DTO.
4. Le CTA bilan encode uniquement des identifiants autorisés. Le parseur serveur du bilan les revalide avant préremplissage modifiable.
5. Le CTA WhatsApp construit un message sans PII, puis le passe au helper canonique qui possède seul le numéro.

## Accessibilité et responsive

- Un seul H1, titres hiérarchisés, fieldsets/legends, boutons natifs, focus visible et cibles tactiles de 44 px.
- Onglets avec gestion clavier, panneaux reliés par `aria-controls`, accordéons accessibles et résumé annoncé via `aria-live="polite"`.
- La grille planning devient une liste verticale sous 640 px ; aucun conteneur n'impose de largeur minimale.
- Le panneau mobile réserve son espace, respecte `env(safe-area-inset-bottom)` et peut être replié.

## Erreurs et états

- Une donnée de contrat invalide provoque une exception Zod au build.
- Une sélection incomplète désactive le passage à l'étape suivante et affiche un résumé explicite sans pack.
- Une combinaison Première/Terminale concernée affiche la validation pédagogique sans inventer de cohorte.
- L'absence de pack correspondant est un état de données indisponibles, jamais un fallback vers un autre prix.

## Vérification

- Tests unitaires test-first pour la logique pure, le parseur de préremplissage, WhatsApp, analytics et garde-fous anti-hardcode.
- Tests composants pour le rendu, les profils, le résumé, les onglets et les accordéons.
- Playwright sur les routes, les quatre accès, les parcours des trois niveaux, les largeurs 390/320 et l'absence de paiement ou disponibilité fictive.
- Typecheck, lint, tests campagne/pricing, build, contrôle sitemap/liens/métadonnées/secrets, captures temporaires et `git diff --check`.
