# Homepage Hub Deux Offres Design

## Goal

Remplacer la homepage corporate actuelle de `nexusreussite.academy` par un hub court et orienté conversion qui met immédiatement en avant les deux offres actives : les Stages Printemps 2026 (`/stages`) et la Plateforme EAF (`https://eaf.nexusreussite.academy`).

## Constraints

- Conserver `CorporateNavbar` et `CorporateFooter` tels quels.
- Ne pas modifier `/stages` ni le sous-domaine EAF.
- Ne pas utiliser GSAP dans la nouvelle homepage ni dans le bandeau promo.
- Garder les composants GSAP existants dans `components/sections/`; seule la homepage cesse de les importer.
- Archiver la homepage actuelle et ses sections dans `archive/homepage-corporate-v1/`.
- Utiliser le design system existant : Tailwind, `Space Grotesk`, `Inter`, `IBM Plex Mono`.

## Current State

- La homepage active est `app/page.tsx`.
- Elle est une landing corporate longue composée de huit sections GSAP.
- Le layout global est `app/layout.tsx` avec métadonnées génériques et sans bandeau promotionnel partagé.
- La navigation publique pointe déjà vers `/stages` dans la navbar et le footer.

## Target Experience

Le visiteur doit comprendre en moins de cinq secondes :

1. ce qu’est Nexus Réussite ;
2. quelles sont les deux offres phares du moment ;
3. quelle action entreprendre immédiatement.

Le parcours doit être linéaire :

- bandeau promo ;
- hero ;
- deux cards offres ;
- signaux de confiance ;
- aide au choix ;
- témoignages ;
- CTA final.

## Architecture

### Global Layout

Ajouter `components/layout/PromoBanner.tsx` dans `app/layout.tsx`, juste avant `{children}`.

- Le bandeau est un client component.
- Il peut être fermé localement et retourne `null` lorsqu’il est masqué.
- Il affiche deux messages sur desktop et un carousel simple sur mobile.
- La navbar reste rendue par chaque page, sous le bandeau.

### Homepage

La nouvelle `app/page.tsx` devient un composant serveur simple qui :

- compose les nouvelles sections ;
- définit les métadonnées SEO spécifiques à la homepage ;
- n’importe plus aucun composant GSAP.

Sections prévues :

- `HomeHero`
- `FlagshipOffers`
- `TrustSection`
- `DecisionHelper`
- `HomepageTestimonials`
- `HomepageFinalCTA`

### Shared Utilities

Créer sous `components/sections/homepage/` :

- `CTAButton.tsx` pour homogénéiser les CTA vert/violet/outline ;
- `CountdownChip.tsx` pour les compteurs J-X côté client.

## Visual System

- Fond principal : `#050a14`
- Fond secondaire : `#0a1628`
- Vert produit stages : `#10b981`
- Violet produit EAF : `#a78bfa`
- Rouge urgence : `#ef4444`
- Ambre accents : `#f59e0b`

Ces couleurs sont ajoutées en extension Tailwind sous les noms préfixés `nexus-*`.

Fonts :

- Display : `Space Grotesk`
- Body : `Inter`
- Mono : `IBM Plex Mono`

## Component Responsibilities

### PromoBanner

- State local `isVisible`.
- Rotation mobile toutes les 4 secondes.
- Desktop : deux offres séparées par un divider.
- Liens : `/stages` et domaine EAF en nouvel onglet.

### HomeHero

- H1 principal.
- Deux CTA visuellement distincts.
- Réassurance immédiate.
- Rendu serveur pour SEO.

### FlagshipOffers

- Deux cards de hauteur identique.
- Compteurs J-X via `CountdownChip`.
- Mini-tableau comparatif visible seulement sur desktop.
- Couleur verte pour stages, violette pour EAF.

### TrustSection

- Quatre chiffres clés.
- Trois engagements.
- Aucun effet complexe.

### DecisionHelper

- Client component.
- Wizard simple avec état en trois étapes.
- Mapping déterministe des recommandations.
- CTA primaire vers `/stages` ou EAF, CTA secondaire WhatsApp.

### HomepageTestimonials

- Grille statique responsive.
- Tags colorés par type d’offre.

### HomepageFinalCTA

- Résume la proposition de valeur.
- Double CTA final.
- Coordonnées de contact.

## Responsive Rules

- Mobile : CTA empilés, cards en colonne, tableau comparatif masqué, carousel bandeau actif.
- Tablet : cards en deux colonnes si l’espace le permet.
- Desktop : conteneur `max-w-7xl`, bandeau complet, cards équilibrées, témoignages en quatre colonnes.

## Links

- Stage principal : `/stages`
- EAF : `https://eaf.nexusreussite.academy` avec `target="_blank" rel="noopener noreferrer"`
- WhatsApp : lien prérempli stages printemps
- Téléphone : `tel:+21699192829`
- Email : `mailto:contact@nexusreussite.academy`

## SEO

La homepage aura des métadonnées dédiées centrées sur les deux offres, distinctes des métadonnées globales du layout.

## Verification

- `npm run lint`
- `npm run build`
- tests ciblés sur la homepage, le bandeau promo, les compteurs et l’aide au choix
- vérification grep : pas d’import GSAP dans `app/page.tsx`
- vérification visuelle responsive si possible
