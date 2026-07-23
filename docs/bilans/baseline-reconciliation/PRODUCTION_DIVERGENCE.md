# Divergence de production

## État revalidé en lecture seule

Le 11 juillet 2026 :

| Élément | Valeur |
|---|---|
| Hôte applicatif | chemin `<APP_DIR>` |
| Branche | `main` |
| HEAD | `1b8219b1cfcfe63354d8cb4035645143e27e5a43` |
| Origine | `git@github.com:cyranoaladin/nexus-project_v0.git` |
| État suivi | 0 modification |
| Non suivis | 0 fichier |
| PM2 | `<PROCESS_NAME>`, online, cluster, PID observé 1518444, 102 redémarrages |
| Exécutable | `.next/standalone/server.js` |
| Répertoire PM2 | `<APP_DIR>` |

Le reflog indique un reset vers `origin/main` le 27 juin 2026 à 09:15:17 +02. `.next/BUILD_ID` est daté 09:16:35 +02 et le processus PM2 a démarré vers 09:17:06 +02. La fenêtre de déploiement est donc **inférée** au 27 juin vers 09:15–09:17 +02. Il n'existe pas, dans les preuves lues, d'enregistrement de release plus précis ou d'identité d'opérateur : `UNKNOWN_PRODUCTION_FACT`.

La référence `origin/main` locale au serveur est ancienne car aucun fetch n'a été effectué en production. L'origine GitHub actuelle pointe désormais `main` sur `c90b142c`.

## Distance

- production → local : 38 commits ;
- production → origin/main : 41 commits ;
- dans le périmètre Bilans demandé, production → origin/main : 56 fichiers modifiés, 864 insertions et 283 suppressions ;
- trois migrations existent après la production : EAM progress, BusinessConfig, BusinessConfigAudit.

Le statut réel de ces migrations dans la base de production n'a pas été lu : `UNKNOWN_PRODUCTION_FACT`.

## Impact critique

La production ne contient pas :

- les validations Zod ajoutées sur les routes Bilan et plusieurs routes coach/parent/élève ;
- la standardisation des erreurs ;
- les correctifs G-SEC de `origin/main` ;
- le scope d'ownership ajouté à `POST/GET /api/bilans/generate` ;
- le test IDOR correspondant ;
- les modèles/migrations BusinessConfig, sans impact direct sur le modèle Bilan mais avec impact de séquencement des migrations futures.

La production conserve donc le P0 permettant à un coach autorisé au rôle de cibler un Bilan arbitraire pour génération/polling. `origin/main` ferme statiquement cette partie avec `buildBilanWriteWhere`/`buildBilanReadWhere`, mais la création d'un Bilan avec un élève arbitraire reste ouverte sur toutes les bases.

Le commit de production existe sur GitHub. Le risque n'est pas une perte de code, mais :

- **P0 sécurité runtime** : code déployé dépourvu du correctif d'ownership generate ;
- **P1 gouvernance/release** : production 41 commits derrière `origin/main`, remote ref local obsolète et CI du commit déployé en échec ;
- **P1 reproductibilité opérationnelle** : aucune preuve de release manifest, migrations appliquées ou rollback testé.

## Limites

N'ont pas été lus : secrets, variables, tables, utilisateurs, rapports ou prompts. Restent `UNKNOWN_PRODUCTION_FACT` : schéma DB effectif, migrations appliquées, artefact exact au-delà du BUILD_ID, raisons des redémarrages PM2 et procédure de rollback exécutée.
