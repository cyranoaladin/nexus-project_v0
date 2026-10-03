# Inventaire du stockage historique du TP POO (legacy)

## Date

Relevé le 2026-10-02 (≈ 20:00 UTC), en lecture seule sur le serveur de production, avant toute modification.

## Verdict en une ligne

**Le stockage historique contient 0 dépôt.** Aucun identifiant `POO…` n'y est enregistré, ni aujourd'hui ni dans aucune des sauvegardes existantes. Rien n'a été modifié, supprimé ni associé.

## Ce que le système legacy est réellement

| Élément | Constat |
|---|---|
| Service | `nexus-poo.service` (systemd, `python3 /opt/nexus-poo/server.py`, 127.0.0.1:8765, utilisateur `nexus-poo`) |
| Exposition | Nginx : `/ateliers/poo/` (statique `/var/www/nexus-ateliers/poo/`) et `/ateliers/poo/api/` (proxy vers le service) |
| Base | SQLite `/var/lib/nexus-poo/traces.sqlite3`, mode journal `delete` (pas de WAL) |
| Table | `submissions(id, client_id, received, sha, alias, groupe, session, payload)` + index `unique_payload`, `unique_submit_key`, `by_received` |
| Ressources privées | `/var/lib/nexus-poo/resources/maths/` : `subject.pdf`, `correction.pdf`, `teacher-guide.pdf`, `MATHS_RESOURCES_MANIFEST.json` |
| Contenu pédagogique | `/opt/nexus-poo/src/content.json` (8 étapes : 7 + bonus), repris tel quel par la nouvelle plateforme |

### Comment une trace était identifiée

L'identité d'une trace n'est pas un compte : c'est un champ libre `alias` saisi par l'élève (placeholder « Exemple : E03 »), accompagné d'un `groupe` et d'un code de séance. Les codes `POO01`, `POO02`… évoqués dans le cahier des charges sont donc des valeurs de ce champ `alias` ; aucune table de correspondance vers des élèves n'a jamais existé.

## Fichier source

| Champ | Valeur |
|---|---|
| Chemin | `/var/lib/nexus-poo/traces.sqlite3` |
| Taille | 61 440 octets |
| Dernière modification | 2026-09-26 09:25:58 (heure du serveur) |
| SHA-256 | `dd6c60e9e9204099fc91ea223ebfaa340597858e47a5129064e3acf26ee5ec03` |
| Nombre de dépôts | **0** |
| Identifiants de traces | aucun |
| Dates min / max de réception | aucune (table vide) |
| `PRAGMA integrity_check` | ok |

Le SHA-256 du fichier source relevé **avant** et **après** la sauvegarde est identique : le fichier n'a pas été touché.

## Historique d'activité (journal systemd + logs nginx)

Toute l'activité d'écriture sur `/ateliers/poo/api/submissions` se concentre le 2026-09-26, en trois salves de quelques secondes, chacune suivie d'une suppression authentifiée par la clé enseignant :

| Salve | Dépôts acceptés (200) | Suppressions (200) | Refus de test (400/403) |
|---|---|---|---|
| 04:52–04:54 | 2 | 2 | 6 (1 × 400, 5 × 403) |
| 05:38–05:39 | 3 | 3 | 0 |
| 09:25 | 3 | 3 | 0 |

Ce profil (refus de validation, dépôts, suppression dans la minute) est celui de tests de recette automatisés, pas d'un usage par des élèves. Le trafic vers `/ateliers/poo/` est de 163 requêtes le 26/09, 2 le 27/09 et 2 le 02/10 ; aucune écriture après le 26/09.

Les 7 sauvegardes quotidiennes de `/var/backups/nexus-poo/` (du 26/09 au 02/10) contiennent toutes 0 dépôt. Il n'y a donc pas de trace « purgée » à restaurer depuis elles.

## Où le travail réel des élèves peut se trouver

Le travail d'un élève qui aurait déjà fait le TP **n'est pas sur le serveur**. Les hypothèses restantes, à vérifier par l'enseignant, sont :

1. travail resté dans le `localStorage` du navigateur de l'élève (le TP historique y gardait la progression) ;
2. fichiers « trace JSON » exportés par les élèves et remis à l'enseignant hors serveur ;
3. TP pas encore réalisé par les élèves.

Aucune de ces sources n'est accessible depuis le serveur. Le pont d'import futur (voir `docs/legacy-poo/LEGACY_POO_LINKING.md`) ne peut donc lier que ce qui existe réellement dans la base legacy ; l'ingestion de fichiers JSON serait une extension distincte.

## Risques d'effacement automatique sur le legacy

Le legacy contient deux mécanismes qui détruiraient des traces s'il en recevait :

- **Purge par ancienneté** : `NEXUS_RETENTION_DAYS=90`. `purge()` supprime les dépôts reçus il y a plus de 90 jours. Elle s'exécute au démarrage, à chaque lecture/écriture de l'API et chaque nuit via `nexus-poo-maintenance.timer` (03:40, prochain passage le 2026-10-03).
- **Rotation des sauvegardes** : `--keep 14`. Seules les 14 dernières sauvegardes `traces-*.sqlite3` sont conservées, et elles reflètent l'état déjà purgé.
- Route `DELETE /api/submissions/<id>` accessible avec la clé enseignant.

Aucun de ces réglages n'a été modifié par cette mission. Tant que la base est vide, ces mécanismes ne détruisent rien. **Si de vrais dépôts devaient arriver sur le legacy pendant la transition, il faudrait d'abord positionner `NEXUS_RETENTION_DAYS=0` (la fonction `purge` retourne alors immédiatement) et archiver séparément** ; c'est une modification du service legacy qui requiert un accord explicite.

## Sauvegarde indépendante réalisée

Écrite dans un répertoire **nouveau**, hors du motif d'élagage `traces-*.sqlite3`, par l'API de sauvegarde SQLite (source ouverte en `mode=ro`).

| Champ | Valeur |
|---|---|
| Répertoire serveur | `/var/backups/nexus-poo-legacy-archive/` (root, 0700) |
| Base sauvegardée | `legacy-poo-traces-20261002T200005Z.sqlite3`, 61 440 octets |
| SHA-256 de la sauvegarde | `7c918e1fcbc9cd2bb8fbbf30a7d07fe606a93b4c0031002bb95ab09c5e4caa3d` |
| Empreinte logique source (schéma + lignes triées) | `3775bda16a04782856bfeca8584a91c0ca309b12e76f0df6ca2f0a14525bf36e` |
| Empreinte logique sauvegarde | identique à la source |
| `integrity_check` sauvegarde | ok |
| Copie hors serveur | poste de l'enseignant, `Documents/Nexus_Conservation/legacy-poo-20261002/`, 10/10 fichiers de données revérifiés par `sha256sum -c` |

Note d'honnêteté sur les empreintes : le SHA-256 *fichier* de la sauvegarde (`7c918e…`) diffère de celui de la source (`dd6c60…`) parce que l'API de sauvegarde réécrit les pages ; la preuve d'équivalence est l'**empreinte logique identique** (schéma + contenu). La sauvegarde est bit à bit identique aux sauvegardes quotidiennes récentes (`7c918e…`), ce qui est cohérent avec une base vide inchangée depuis le 26/09.

Contenu de l'archive : la base, le code du service (`server.py`, `content.json`), les pages (`index.html`, `enseignant.html`, `ressources.zip`), le snippet nginx et les ressources privées Maths, avec `SHA256SUMS-20261002T200005Z.txt`. (Ce fichier de sommes se liste lui-même par construction : sa propre ligne ne se revérifie pas, c'est attendu.)

## Statut des drapeaux de la mission

```
LEGACY_POO_DELETED        = NO
LEGACY_POO_MODIFIED       = NO
LEGACY_POO_AUTO_MAPPED    = NO   (mapping réalisé : 0)
LEGACY_POO_BACKUP_VERIFIED = YES
LEGACY_POO_TRACE_COUNT    = 0
```

## Rollback

Aucune mutation du legacy n'a été faite : il n'y a rien à annuler. Le répertoire `/var/backups/nexus-poo-legacy-archive/` est un ajout ; le supprimer ne change pas le service legacy.
