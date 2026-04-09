# Sitewide Iconography Design

## Goal

Unifier toute l'iconographie visible du produit Nexus Réussite autour de `lucide-react`, avec un rendu sobre, cohérent et professionnel sur les pages marketing, les dashboards, les stages, les badges et les surfaces transactionnelles visibles utilisateur.

## Scope

Inclus :
- pages `app/` visibles utilisateur
- composants `components/` rendus dans l'UI
- badges et surfaces pilotées par données qui affichent aujourd'hui des emojis
- emails transactionnels principaux

Exclus :
- logs techniques
- tests, fixtures et docs internes
- commentaires source

## Approach

1. Créer un registre central d'icônes sémantiques pour éviter le bricolage local.
2. Remplacer les champs `icon: string` rendus en UI par des mappings Lucide ou des clés sémantiques.
3. Retirer les emojis décoratifs des CTA, titres de cartes, labels de statut et messages d'assistance visibles utilisateur.
4. Conserver le sens métier des surfaces existantes : une icône doit aider la lecture, pas décorer gratuitement.

## Rules

- Standard unique : `lucide-react`
- Pas de mélange emoji + Lucide dans une même surface UI
- Couleur héritée du contexte quand possible
- Tailles stables : `h-4 w-4`, `h-5 w-5`, `h-6 w-6`
- Fallback explicite via une icône neutre si la donnée ne matche pas

## Risk Controls

- Ne pas casser la donnée persistée si seul le rendu visuel doit changer
- Préférer un mapping au rendu pour les badges existants avant toute migration métier
- Vérifier les pages les plus exposées : `/`, `/stages`, `/offres`, `/plateforme-aria`, dashboards parent/élève

## Verification

- grep ciblé des emojis sur les surfaces live traitées
- `npm run lint`
- `npm run build`
- tests ciblés sur les pages et composants impactés
