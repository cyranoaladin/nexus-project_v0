# Changement authentifié du mot de passe V1 — lot suivant

## Critères d'acceptation avant implémentation

1. La cible est exclusivement l'identité V1 de la session vérifiée ; un ID
   fourni dans le corps et une session Core-v2 sont refusés.
2. Le mot de passe actuel est vérifié ; les nouvelles credentials respectent
   la politique commune huit caractères / 72 octets UTF-8.
3. L'état d'activation, le rôle, la fusion éventuelle du compte et la version
   de session sont recontrôlés pendant l'écriture transactionnelle.
4. Une seule des modifications concurrentes d'une même version réussit ;
   l'autre retourne un conflit sans mutation supplémentaire.
5. Password, incrément de version, invalidation des tokens historiques et
   événement d'audit durable sont atomiques. Un échec d'audit annule tout.
6. L'audit contient uniquement un identifiant opaque, une version, un type,
   une date et une corrélation opaque ; aucun mot de passe, hash, cookie ou PII.
7. Une migration additive conserve les comptes existants et ajoute l'audit
   avec FK RESTRICT et protection append-only. Aucun backfill de credentials.
8. L'API impose CSRF, limite réelle du corps, limites IP et identité,
   validation stricte et réponses privées sans cache.
9. Deux anciennes sessions deviennent invalides ; une connexion avec le
   nouveau mot de passe réussit. Le formulaire est accessible sur mobile et
   ordinateur et ne confirme pas une réponse serveur ambiguë.
10. Les preuves sont renouvelées sur le SHA du lot avant publication.

## Compatibilité

La version interne du JWT reste absente de la session publique. Elle est lue
uniquement côté serveur à partir du JWT chiffré, avec la configuration officielle
d'authentification ; les valeurs de secrets ne sont jamais affichées. Les comptes
Core-v2 continuent d'utiliser leur route native distincte. Le reset e-mail V1
reste lié au hash courant. Les challenges de récupération téléphone ouverts
sont révoqués ; les challenges d'activation ne sont pas détournés en audit.

## Implémentation et premières preuves

Service `lib/auth/change-v1-password.ts`, API native
`/api/auth/password-change`, formulaire partagé avec endpoint choisi côté serveur.
Le JWT est décodé uniquement depuis le cookie, selon le secret et le cookie HTTPS
du serveur. Identité/rôle/version doivent correspondre à la session vérifiée ;
aucune version interne n'est publiée. Secret absent ou configuration AUTH_URL /
NEXTAUTH_URL contradictoire : refus, sans fallback.

Les tests PostgreSQL passent : 11 scénarios couvrant les cinq rôles, les refus,
la concurrence, la révocation des recoveries, l'invalidation du reset e-mail,
le rollback sur erreur d'audit et les contraintes append-only / FK. Sept suites
unitaires, HTTP, UI, rate limiting et architecture : 192 tests verts. Lint et
typecheck finaux exit 0. Le premier typecheck rouge portait sur les literals du
mock JWT et la prop UI pas encore implémentée ; aucune désactivation du contrôle.

Les deux E2E V1 initiaux (390 / 1440 px) échouent sur le build c458 car le
formulaire de changement est absent : défaut effectivement reproduit après deux
connexions réelles. Le nouveau build et leur relance sont encore requis. Les
traces, captures et vidéos sont désactivées pour ces tests de credentials.

## Migration additive

`20261003211500_account_security_events` crée une table d'audit, un enum, FK
RESTRICT, unicité utilisateur/version, contraintes de version/corrélation et
trigger de refus UPDATE/DELETE. Aucun compte, ancien hash, token ou historique
n'est converti. Aucune ancienne table n'est supprimée ; rollback applicatif
compatible avec le schéma étendu.

Sur bases possédées synthétiques : déconnexion après DDL avant COMMIT annule
table et enum ; 120 tables et 70 lignes historiques restent identiques. Deploy
versionné puis relance : succès, 121 tables et toujours 70 lignes, nouvelle table
d'audit vide. Base vide et relance : succès. Ledger : une seule entrée terminée.
Le manifeste FK est vérifié contre `pg_constraint` : exit 0. Preuve privée
`.artifacts/recovery/security-migration-proof.json` et harness conservés. Ces
comptages ne constituent pas une restauration ou répétition de volume production.

## Limites avant promotion

Qualification E2E et build sur le SHA final à renouveler. Une migration simultanée
de l'autorité d'identité entre les deux stores nécessite la coordination
opérationnelle du migrateur ; aucune atomicité interbases n'est revendiquée. Le
trigger empêche UPDATE/DELETE par les écritures ordinaires, pas un administrateur
DB privilégié désactivant les protections. La rétention globale et les autres
gates de production restent non prouvées.
