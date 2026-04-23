# F20 — Badges Maths non persistés en Prisma

## État actuel (LOT 5 Étape 2)

### Problème identifié
Les badges Maths gagnés dans les cockpits **Maths 1ère** et **Maths Terminale** sont stockés dans :
1. **Zustand + localStorage** (`nexus-maths-lab-v2`, `nexus-maths-terminale-lab-v1`) — badges dans le store local
2. **Supabase** (backup async via API) — mais c'est maintenant déprécié après F16/F17

Ils ne sont **PAS** synchronisés avec la table Prisma `student_badges` qui existe pourtant dans le schéma.

### Table Prisma existante (non utilisée pour les badges Maths)

```prisma
model student_badges {
  id        String   @id @default(uuid())
  studentId String
  badgeId   String
  awardedAt DateTime @default(now())
  awardedBy String?  // coach ou système
  context   Json?    // contexte d'attribution (ex: { assessmentId, chapterId })
}
```

### Source de vérité actuelle

| Module | Stockage badges | Persistance Prisma |
|--------|-----------------|-------------------|
| Maths 1ère | Zustand (`badges: string[]`) | ❌ Non |
| Maths Terminale | Zustand (`badges: string[]`) | ❌ Non |
| Autres modules (stages, sessions) | `student_badges` | ✅ Oui |

### Impact
- Perte des badges Maths si l'utilisateur efface son localStorage
- Incohérence entre le dashboard élève (qui lit `student_badges`) et les cockpits Maths
- Double système de badges sans pont de synchronisation

## Correctif possible (hors scope LOT 5 Étape 2)

Pour résoudre F20 complètement, il faudrait :

1. **Ajouter une mutation côté API** : `POST /api/student/badges` pour persister un badge
2. **Modifier les hooks Zustand** : synchroniser les badges gagnés avec Prisma via l'API
3. **Migration des badges existants** : script de transfert Supabase → Prisma
4. **Unification de la lecture** : dashboard et cockpits utilisent la même source

## Décision LOT 5 Étape 2

**F20 n'est pas corrigé dans cette étape** car :
- Nécessite un chantier transverse (bridge Zustand ↔ Prisma)
- Dépend de la stabilisation de F16/F17 (migration vers Prisma déjà en cours)
- Risque de régression sur la progression Maths si mal implémenté

**Recommandation** : Traiter F20 dans un LOT dédié "Unification système de badges" avec :
- Audit complet des 3 systèmes de badges (Zustand, Supabase legacy, Prisma)
- Design d'un bridge fiable avec retry
- Migration sans perte de données
