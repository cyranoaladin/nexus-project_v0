# Feature — Dashboard élève Première STMG / Stage EAM STMG

## Résumé
- Objectif : fournir un dashboard dédié aux élèves de Première STMG préparant l'Épreuve Anticipée de Mathématiques 2026, sans calculatrice.
- Routes/pages : `/dashboard/eleve/stage-eam-stmg`, `/dashboard/eleve/stage-eam-stmg/diagnostic`, `/dashboard/eleve/stage-eam-stmg/livret`.
- Composants : `components/stage-eam-stmg/*`, dont carte d'entrée, radar, runner d'automatismes, diagnostic, livret imprimable.
- Hook : `hooks/stage-eam-stmg/useStageProgress.ts`, persistance locale namespacée par `studentId`.
- Contenu : `content/stage-eam-stmg/*`, taxonomie STMG, diagnostic, automatismes, exercices et planning.
- Tests : `__tests__/stage-eam-stmg/*` et `__tests__/scripts/create-stmg-students.test.ts`.

## Corrections UI
- Déduplication StageEntryCard : la carte d'accès STMG n'est rendue qu'une seule fois dans la rubrique cockpit du dashboard élève.
- Condition d'affichage : `isPremiereStudent && isStmgTrack`, avec protection interne supplémentaire via `isPremiereStmg(student)`.

## Script création élèves
- Dry-run par défaut : le script n'écrit rien sans `--apply`.
- Fichier d'entrée : `--input <fichier-json>` obligatoire.
- Pas de hardcoding : aucun nom ou email réel n'est codé dans le script.
- Exemple versionné : `scripts/examples/stmg-students.example.json`.
- Fichier réel : à créer localement hors Git, par exemple `scripts/data/stmg-students.real.json`.
- `--apply` obligatoire : seule cette option déclenche l'écriture.
- Mots de passe temporaires : générés uniquement au moment du `--apply`, affichés une seule fois sur stdout, jamais écrits sur disque.
- Santé DB requise : `assertDatabaseCompatible` vérifie que le Prisma Client peut lire `User` avant toute écriture.

Commandes :

```bash
npx tsx scripts/create-stmg-students.ts --input scripts/examples/stmg-students.example.json
npx tsx scripts/create-stmg-students.ts --input /chemin/local/stmg-students.real.json --apply
```

## Blocage QA
- Cause : le Prisma Client actuel est généré depuis un `schema.prisma` contenant des champs TOTP non migrés.
- `users.totpSecret` absent : la base QA issue des migrations ne contient pas les colonnes `totpSecret`, `totpEnabledAt`, `totpBackupCodes`, `totpLastUsedAt`.
- Décision : ne pas traiter TOTP dans le chantier STMG.
- Lot séparé requis : `P1-C — Alignement Prisma TOTP schema/migrations` ou `chore(db): align TOTP schema and migrations`.

## Non effectué
- Création comptes : non effectuée tant que la base QA n'est pas alignée.
- QA navigateur connectée : non effectuée tant que les comptes ne peuvent pas être créés.
- Déploiement : aucun déploiement réalisé.

## Prochaine étape
1. Traiter Prisma/TOTP dans un lot séparé.
2. Relancer `npm run test:e2e:setup`.
3. Lancer le dry-run du script avec un fichier local non committé.
4. Valider la création des comptes élèves STMG avec ce fichier local.
5. Réaliser la QA navigateur STMG/non-STMG.
