# Maths 1ere Access Design

**Date:** 2026-04-18

## Goal

Restreindre l'acces a `/programme/maths-1ere` pour qu'il soit disponible a tous les parents, admins, assistantes et coachs, ainsi qu'aux seuls eleves dont le niveau stocke en base est `Première`.

## Constraints

- Utiliser `Student.grade` comme source de verite pour le niveau scolaire.
- Conserver la redirection existante vers `/auth/signin?callbackUrl=/programme/maths-1ere` pour les utilisateurs non connectes.
- Ne pas modifier le comportement du client `MathsRevisionClient`; le controle d'acces doit rester cote serveur.
- Limiter le changement a la page `maths-1ere` sans etendre la regle a tout le middleware ou a d'autres pages programme.

## Existing Architecture

- `app/programme/maths-1ere/page.tsx` verifie actuellement uniquement l'authentification via `auth()`.
- Le role est disponible dans la session NextAuth.
- Le niveau scolaire est stocke sur `Student.grade` dans `prisma/schema.prisma`.
- `app/maths-1ere/page.tsx` est seulement un alias qui redirige vers `/programme/maths-1ere`.

## Proposed Changes

1. Ajouter un garde serveur dans `app/programme/maths-1ere/page.tsx`.
2. Autoriser directement les roles `PARENT`, `ADMIN`, `ASSISTANTE` et `COACH`.
3. Pour le role `ELEVE`, charger `prisma.student.findUnique({ where: { userId } })` et n'autoriser l'acces que si `grade === 'Première'`.
4. Rediriger tout utilisateur authentifie mais non autorise vers son dashboard natif:
   - `ELEVE` -> `/dashboard/eleve`
   - `PARENT` -> `/dashboard/parent`
   - `COACH` -> `/dashboard/coach`
   - `ASSISTANTE` -> `/dashboard/assistante`
   - `ADMIN` -> `/dashboard/admin`
   - fallback -> `/dashboard`

## Error Handling

- Session absente: redirection signin existante avec callback.
- Session presente mais profil eleve absent ou grade different de `Première`: redirection dashboard eleve.
- Role inattendu ou incomplet: redirection `/dashboard`.

## Testing Strategy

- Ajouter un test unitaire cible sur `app/programme/maths-1ere/page.tsx`.
- Couvrir:
  - non connecte -> redirect signin avec callback
  - eleve `Première` -> rendu du composant
  - eleve non `Première` -> redirect dashboard eleve
  - parent/admin/assistante/coach -> rendu du composant sans requete Student
