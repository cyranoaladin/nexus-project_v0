# Refonte UI et Copy — Landing `/stages`

## Objectif

Améliorer la landing active `Stages Printemps 2026` pour la rendre plus premium, plus lisible et plus orientée conversion, sans changer l'offre, les prix, les CTA métiers ni la structure globale de la route.

## Problèmes observés

- La hiérarchie visuelle est encore trop uniforme entre les sections.
- Le hero et les cartes programmes sont trop verbeux pour une lecture rapide.
- Les emojis utilisés comme icônes dégradent la perception premium.
- Certaines sections répètent la même information au lieu de faire progresser la décision.
- Le CTA de réservation est présent, mais pas toujours porté par un contexte éditorial assez tendu.

## Direction retenue

- Conserver la landing Spring 2026 active sur `/stages`.
- Garder les sections principales, mais renforcer la narration : urgence, ROI, choix du pack, passage à l'action.
- Remplacer les emojis décoratifs par des icônes `lucide-react`.
- Réduire la densité de texte et mieux hiérarchiser les blocs clés.
- Uniformiser les badges, les micro-labels, les listes de bénéfices et les CTA.

## Changements prévus

### Hero

- Badge plus sobre, sans emoji.
- Sous-titre plus court et plus incisif.
- Ajout d'une ligne de bénéfices scannable avec icônes Lucide.
- Différenciation plus nette entre CTA primaire et secondaire.

### Header sticky

- Compteurs plus compacts et plus lisibles.
- CTA unique plus direct.

### Timeline + comparaison marché

- Traitement plus éditorial, moins “bloc de texte”.
- Icônes Lucide homogènes.
- Mise en avant plus claire du ROI et du différentiel avec le marché.

### Grille académies

- Cartes plus lisibles avec meilleure structure :
  - titre
  - promesse
  - caractéristiques clés
  - prix
  - disponibilité
  - CTA
- Icônes Lucide mappées par pack.
- Réduction du bruit visuel.

### Grand Oral / Pricing / Social proof / FAQ / CTA final

- Uniformisation de la mise en page.
- Renforcement des micro-titres et des bénéfices concrets.
- Cohérence iconographique et typographique.

## Contraintes

- Pas de changement du modèle de données métier.
- Pas de changement des routes ni de la page `/stages/fevrier-2026`.
- Pas d'ajout de nouvelle bibliothèque d'icônes.
- Pas de GSAP.

## Vérification

- Tests ciblés sur le rendu de la landing active.
- Vérification que la page reste exempte des marqueurs Février.
- `npm run lint`
- `npm run build`
