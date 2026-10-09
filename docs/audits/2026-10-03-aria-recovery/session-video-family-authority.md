# Autorité actuelle et concurrence sur le salon vidéo

Date : 4 octobre 2026. Base publiée : 91161a7cf. Statut global : NOT_READY.

## Défauts reproduits

Le parent historique du booking pouvait lire noms/salon et déclencher la séance malgré une révocation familiale Core. Six tests rouges ont reçu 200 au lieu des refus/pannes attendus ou constaté l’absence de décision de façade. La revue a également identifié un CAS ne protégeant que le statut : deux nouveaux tests rouges prouvent l’absence d’identités dans son WHERE et un retour 200 avec salon après un CAS perdu sur une séance restant SCHEDULED.

## Correction

Parent : lire uniquement studentId, mapper User vers Student et appeler la façade avec read pour GET, mutation pour POST et sa revalidation. Une autorisation CORE_VERIFIED_READ ne peut pas muter V1 ; seule la compatibilité LEGACY_ALLOWED explicitement accordée permet cette mutation. Élève et coach : identité ET rôle correspondant dans le WHERE serveur. Aucun nouveau droit staff.

Les données privées et le salon ne sont chargés qu’après décision. L’update conditionnel porte aussi studentId et coachId attendus. Si sa revalidation retrouve encore SCHEDULED après un CAS perdu, répondre 409 sans salon ; une annulation/fin reste refusée et un join concurrent déjà IN_PROGRESS reste idempotent. Cache privé/no-store, Vary Cookie/Authorization, y compris les réponses rate-limit en conservant leurs autres headers. Erreurs serveur à marqueurs constants.

## Preuves

- Rouge familial : 6 échecs ; rouge identité/CAS : 2 échecs, 8 réussites.
- Vert élargi : 4 suites / 73 tests.
- Typecheck et lint ciblé réussis ; revue readonly de la frontière familiale effectuée. Les deux réserves CAS/cache de cette revue ont été traitées.
- Preuves privées : .artifacts/recovery/session-video-*-private.log.

## Limites

Pas de migration. Les tests de route utilisent des doubles Prisma ; une qualification PostgreSQL de la concurrence reste nécessaire. Les modes de rollout legacy restent explicites, pas VERIFIED universel. La révocation Core et la lecture V1 sont des snapshots distincts : aucun verrou distribué n’est revendiqué. La CI du prochain SHA, le provider vidéo et les smoke navigateur doivent encore qualifier ce parcours. Aucun déploiement effectué.
