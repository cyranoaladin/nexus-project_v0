# Guide Cours Et Ressources

## Périmètre réel en production
- Parcours cours structuré: `/programme/maths-1ere`.
- Ressources élève: `/dashboard/eleve/ressources` + API `/api/student/resources`.

Preuves code:
- `app/programme/maths-1ere/page.tsx`
- `app/dashboard/eleve/ressources/page.tsx`
- `app/api/student/resources/route.ts`

## Gating d’accès
### Programme Maths 1ère
- Nécessite session: redirection vers `/auth/signin?callbackUrl=...` si absent.

Preuve code:
- `app/programme/maths-1ere/page.tsx` (symboles `getServerSession`, `redirect`)

### Ressources élève
- API verrouillée `ELEVE` (401 sinon).
- Page client vérifie `session.user.role === 'ELEVE'`.

Preuves code:
- `app/api/student/resources/route.ts`
- `app/dashboard/eleve/ressources/page.tsx`

## Workflow navigation contenus
```mermaid
flowchart TD
  A[/dashboard/eleve] --> B[/dashboard/eleve/ressources]
  B --> C[GET /api/student/resources]
  C --> D{Role ELEVE ?}
  D -->|non| E[401]
  D -->|oui| F[Liste ressources]
```

## État actuel des données ressources
- L’API renvoie une liste vide par défaut (`resources = []`).
- Commentaire code explicite: modèle Resource non présent.

Preuve code:
- `app/api/student/resources/route.ts` (commentaire `Modèle Resource non présent`)

> **ATTENTION**
> Le flux UI existe, mais le backend contenu est actuellement placeholder vide; aucun contenu mock n’est injecté dynamiquement côté runtime de cette route.
