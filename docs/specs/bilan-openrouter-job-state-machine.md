# Machine à états des travaux OpenRouter

## Portée

Contrat documentaire pour D6. Il ne définit pas encore de modèle Prisma.

## États internes

| État | Sens | Sorties autorisées |
| --- | --- | --- |
| `QUEUED` | snapshot et budget prévalidés, jamais pris | `CLAIMED`, `CANCELLED` |
| `CLAIMED` | lease atomique détenu, appel non commencé | `RUNNING`, `QUEUED`, `CANCELLED` |
| `RUNNING` | tentative fournisseur démarrée et journalisée | `PENDING_REVIEW`, `RETRY_WAIT`, `FAILED_FINAL`, `UNKNOWN_OUTCOME` |
| `RETRY_WAIT` | échec transport retryable, prochaine date fixée | `CLAIMED`, `FAILED_FINAL`, `CANCELLED` |
| `UNKNOWN_OUTCOME` | appel lancé sans résultat réconciliable | `PENDING_REVIEW`, `FAILED_FINAL` par opérateur uniquement |
| `PENDING_REVIEW` | révision valide créée, non approuvée | `COMPLETED`, `REJECTED`, `REGENERATE_REQUESTED` |
| `REGENERATE_REQUESTED` | motif humain enregistré | `QUEUED` via un nouveau job idempotent |
| `REJECTED` | révision conservée, publication interdite | terminal |
| `COMPLETED` | révision approuvée disponible pour publication séparée | terminal |
| `FAILED_FINAL` | non-retryable ou tentatives épuisées | terminal/dead letter |
| `CANCELLED` | arrêt administratif avant appel | terminal |

Les états équipe exposés sont une projection non sensible : `QUEUED`, `RUNNING`,
`PENDING_REVIEW`, `FAILED_RETRYABLE`, `FAILED_FINAL`, `COMPLETED`.

## Commandes et invariants

- `enqueue`: clé obligatoire, même clé + même checksum retourne le même job ;
  même clé + payload différent retourne un conflit.
- `claim`: compare-and-set atomique sur état, `nextAttemptAt` et lease expirée.
- `start`: écrit la tentative avant l'appel fournisseur.
- `succeed`: exige `finish_reason=stop`, schéma, grounding, PII et audience verts.
- `succeed`: exige aussi que toute approbation de texte libre soit retrouvée
  exactement dans le store d'approbations authentifié par son checksum et sa
  provenance ; l'absence du store échoue fermement.
- `retry`: uniquement 408, 429, 502, 503, timeout ou indisponibilité temporaire.
- `fail`: 400/401/402/403, budget, schéma, grounding et sécurité ne sont pas
  retentés automatiquement.
- `review`: auteur, décision, motif et révision source sont immuables et audités.

Un job terminal n'est jamais réouvert. Une régénération crée un nouveau job et
une nouvelle révision ; elle n'écrase aucun artefact.
