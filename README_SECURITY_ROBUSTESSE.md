# Ajouts de sécurité et robustesse

## 1) Validations Pydantic (enums stricts)
- `TaskStatus` et `TaskSource` typés via `Enum` (Pydantic v2), limites de longueur et bornes num.
- Réponses `TaskOut` exposent les enums typés.

## 2) Transactions atomiques par lot
- `POST /dashboard/tasks/bulk`: `db.begin()` et `db.begin_nested()` pour un **SAVEPOINT par op**.
- `POST /sessions/cancel`: boucle avec `db.begin_nested()` dans la version bulk.

## 3) Index partiel pour volumétrie
- Migration Alembic `002_tasks_todo_partial_index.py` crée l’index partiel:
  - `(student_id, due_at) WHERE status = 'Todo'`.

## 4) Rate limiting
- Limiteur DEV en mémoire (`api/utils/ratelimit.py`) :
  - `POST /sessions/{id}/cancel` → 20/min par acteur
  - `POST /sessions/cancel` (bulk) → 40/min par acteur
- Remplacer par Redis en production.

## 5) ACL minimal + Audit Trail
- ACL stub `get_principal` via headers `X-Role`, `X-Actor-Id`, `X-Student-Id`.
- Contrôles : 
  - coach/admin requis pour annulations et sync épreuves
  - student autorisé uniquement pour **son** `student_id`
- Audit trail API → table `events` (déjà existante) : `TASK_*`, `SESSION_CANCELLED`, `EPREUVES_SYNCED`.
