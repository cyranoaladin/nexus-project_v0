# Lot 12 — Fichiers en décision humaine

| Fichier | Statut | Décision actuelle | Options | Recommandation | Décision finale |
|---|---|---|---|---|---|
| `docs/audits/audit-nexus-reussite.md` | PRESENT_UNTRACKED_IN_WORKTREE / Needs human review | Non inclus par défaut | Exclure / Inclure historique / Réécrire / Reporter | Exclure des commits standards ; réécrire ou marquer historique avant inclusion | EXCLUDE_FROM_STANDARD_COMMITS |

## Justification

Le fichier contient des éléments utiles mais partiellement obsolètes pour la RC actuelle :

- `STALE_COUNT` : `173 routes API` vs `178` routes actuelles.
- `STALE_SECURITY_STATUS` : formulation "sans trou" vs `6` P1 visibles.
- `STALE_RUNTIME_STATUS` : Redis/Upstash et `429` runtime non prouvés dans la RC.

Le fichier est présent dans le working tree comme fichier non suivi. Il reste hors commits standards jusqu'à décision humaine explicite et ne doit pas être considéré comme audit courant de la RC.
