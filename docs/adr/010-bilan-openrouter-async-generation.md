# ADR 010 — Génération asynchrone des bilans OpenRouter

## Date et statut

2026-07-31 — `ACCEPTED_FOR_ARCHITECTURE_ONLY`.

Cette ADR n'autorise ni modèle Prisma, ni migration, ni worker, ni route, ni
activation. Leur implémentation appartient à D6 après réduction de la pile,
approbation de la politique modèle et validation des prérequis de confidentialité.

## Contexte

Le scoring canonique est local, déterministe et versionné. Les réponses libres
restent corrigées humainement. OpenRouter ne peut rédiger qu'à partir d'un
snapshot local-first scellé, minimisé et validé. L'appel fournisseur peut durer,
échouer après facturation ou devenir ambigu ; il ne doit donc jamais être exécuté
dans une transaction Prisma ni bloquer une requête HTTP.

## Décision

1. Une transaction courte crée le snapshot immuable et un travail idempotent.
2. Après commit, un worker prend un lease borné puis appelle l'unique client
   `lib/llm/openrouter/` hors transaction.
3. Chaque tentative possède une provenance sûre, y compris les échecs et coûts
   partiels. Aucun prompt, completion brute, secret ou PII n'est journalisé.
4. La réponse est validée localement par schéma, grounding, audience et scan PII.
   Toute preuve citée ou note interne approuvée est vérifiée contre un registre
   d'approbations authentifié ; un checksum auto-calculé ne constitue jamais une
   approbation humaine.
5. Une transaction courte persiste l'invocation et une révision immuable
   `PENDING_REVIEW`, puis un événement de notification durable.
6. Une indisponibilité produit retry différé ou dead letter. Elle ne produit
   jamais de bilan public de substitution.
7. La publication demeure séparée, humaine, explicite, idempotente et révocable.

La queue existante doit être auditée avant implémentation. `JobOutbox` est
réutilisée si elle couvre statut, idempotence, lease, retry, `nextAttemptAt`,
dead letter, checksum de payload, ownership et supervision. Toute seconde queue
exigerait une nouvelle ADR démontrant l'incompatibilité.

## Invariants

- zéro scoring, calibration ou publication par LLM ;
- zéro appel réseau dans une transaction DB ;
- une clé d'idempotence lie snapshot, audience, politique, prompt et schéma ;
- budget réservé avant appel et réconcilié avec le coût fournisseur ;
- `UNKNOWN_OUTCOME` n'est jamais rejoué automatiquement ;
- ZDR, `data_collection=deny` et `require_parameters=true` ne sont jamais relâchés ;
- aucune publication automatique ;
- aucun dual-write Mistral pour un nouveau bilan canonique.

## Conséquences

La génération devient observable et récupérable, mais exige un worker supervisé,
un ledger budgétaire atomique, des leases, une dead letter et une procédure
opérateur. Une panne fournisseur ne bloque ni l'authentification, ni le scoring,
ni les bilans historiques.

## Rollback

Basculer `BILAN_REPORT_GENERATION_MODE=DISABLED`, arrêter le worker, interdire
les nouvelles publications et conserver snapshots, invocations, révisions et
journal d'audit. Aucune suppression destructive ; toute évolution DB se corrige
par migration compensatoire.
