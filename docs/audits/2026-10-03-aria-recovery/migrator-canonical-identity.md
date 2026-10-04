# Identité Core préservée lors d'une relance du migrateur

## Critères d'acceptation

Un roster V1 approuvé peut créer une identité absente de Core. Il ne peut pas
réécrire une identité déjà présente : mot de passe, version de session, état,
rôle, activation et profil restent sous l'autorité du Core. Le manifeste doit
décrire le payload réellement conservé, même en dry run.

## Défaut reproduit

Sur deux bases PostgreSQL synthétiques, les onze tests historiques passaient.
Trois tests supplémentaires échouaient : une relance rétablissait le mot de passe
V1 et réactivait un compte SUSPENDED puis DISABLED. Ces transitions avaient été
effectuées par les services publics `changePassword`, `suspendAccount` et
`disableAccount` du Core.

## Correction

Le chemin User est insert-only, dans la transaction du roster. Une identité
existante n'est jamais mise à jour ; elle est déclarée UNCHANGED avec la raison
CORE_IDENTITY_PRESERVED et l'empreinte de son payload actuel. Une création
concurrente ou une collision d'e-mail fait échouer la transaction, sans upsert
permissif. Le contrat du migrateur est versionné `core-v2-migration/2`.

Aucune migration SQL, donnée de production ou valeur commerciale n'est modifiée.
La compatibilité est additive : les lignes existantes restent intactes.

## Vérification

Le test du mot de passe vérifie aussi le refus de l'ancien mot de passe, la
conservation de la version de session et le hash du manifeste en exécution et
en dry run. Les assertions utilisent des booléens pour éviter d'imprimer les
empreintes de credentials dans les journaux d'échec.

## Limites et rollback

Cette correction ne ferme pas la course entre snapshot V1 et écriture Core,
ni les règles de rattachement des autres objets du roster. Ces points restent
à qualifier séparément avant toute migration réelle. Revenir à l'ancienne
application ne doit pas permettre de relancer l'ancien migrateur qui écrase
les identités ; conserver la version corrigée de cet outil.

L’inventaire exhaustif des mutations User a détecté son ancienne entrée upsert lors de la campagne globale 6a9b635f9. Le contrat est désormais aligné sur la création seule : aucune mutation de User dans apply.ts n’est autorisée. L’assertion exhaustive reste stricte ; les 14 tests réels du migrateur prouvent séparément la conservation du mot de passe et des statuts canoniques.
