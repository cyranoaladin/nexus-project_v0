# Durcissement du stockage NPC et tombstone audité — Design

## Date

11 août 2026

## Contexte

Une soumission pilote terminée conserve quatre références de fichiers dont les
octets ont disparu. L'audit établit que l'application et le worker résolvaient
leur stockage depuis deux variables et deux replis différents. Les fichiers ont
été écrits et relus, puis perdus avec un stockage transitoire.

Cette PR ne modifie pas la production. Elle prépare le schéma, le code et une
commande opérationnelle paramétrée. Le tombstone réel sera exécuté après merge
et déploiement, sous un feu vert séparé.

## Décisions validées

- `NPC_STORAGE_ROOT` devient l'unique source de vérité application/worker.
- Aucune valeur de repli n'est autorisée.
- La racine doit être absolue, existante, accessible et située hors de la
  release active. L'application et le worker échouent au démarrage sinon.
- Les fichiers sources portent une empreinte SHA-256 enregistrée à l'upload.
- Une soumission ne passe jamais à `COMPLETED` sans contrôle de présence, taille
  et empreinte de toutes ses pièces.
- Un défaut d'intégrité place la soumission et les pièces concernées dans un état
  explicite `UNAVAILABLE`; il ne produit pas de rapport terminé.
- `documentType` est obligatoire. Ni l'API ni l'interface ne choisissent
  silencieusement `STUDENT_COPY`.
- Un rapport `COACH_ONLY` est absent des données et composants destinés aux
  parents et élèves.
- Le dossier pilote est tombstoné par une commande séparée, jamais par la
  migration et jamais via un identifiant codé en dur.

## Architecture

### Racine de stockage canonique

Un module serveur dédié expose trois opérations : résolution de la variable,
validation fail-closed et résolution sûre d'un chemin relatif. Le module refuse
une valeur absente ou relative, une racine inexistante ou inutilisable, ainsi
qu'une racine contenue dans la release en cours.

La comparaison s'effectue sur les `realpath` de la racine et de la release. La
racine elle-même ne peut pas être un lien symbolique. Toute lecture ou écriture
refuse les chemins absolus, la traversée, les parents symboliques et les sorties
de la racine réelle. La validation reçoit une capacité explicite : l'application
exige lecture/écriture/traversée; le worker, qui ne produit aucun fichier dans ce
flux, exige seulement lecture/traversée.

Le hook de démarrage Next.js appelle la validation avant de servir. Le worker
appelle la même validation avant sa boucle. Les opérations de stockage et de
conversion utilisent uniquement ce module. Un test d'architecture interdit le
retour des anciennes variables et des replis liés au répertoire courant.

### Intégrité des pièces

L'upload calcule le SHA-256 des octets effectivement écrits et conserve taille
et empreinte sur `CopyPage`. Avant le diagnostic puis immédiatement avant la
transition finale, le worker relit chaque pièce, vérifie le chemin, la taille et
l'empreinte.

Toutes les mutations de pièces utilisent le même protocole transactionnel :
verrouiller la soumission, relire son statut sous verrou, puis seulement créer,
reclassifier ou supprimer une pièce. Le dernier contrôle d'intégrité du worker,
la création du rapport et la transition `COMPLETED` s'exécutent sous ce même
verrou. Ainsi, aucune requête ayant lu un ancien statut ne peut muter le dossier
après un tombstone, et aucune suppression ne peut s'intercaler entre le contrôle
final et `COMPLETED`.

`CopyPage.originalFilePath` est l'inventaire autoritatif des pièces sources :
chacune doit avoir taille et SHA-256 et passer les deux contrôles.
`CopySubmission.storedFilePath` reste un miroir historique : s'il est renseigné,
il doit correspondre exactement à une pièce `STUDENT_COPY` et ses métadonnées
doivent être cohérentes. `convertedFilePaths` ne contient que des dérivés
reproductibles; toute entrée existante doit rester sous la racine et exister,
mais l'intégrité de référence demeure celle de l'original canonique.

Le contrôle retourne un résultat structuré sans chemin absolu ni donnée
personnelle. En cas d'échec, une transaction marque la soumission et les pages
concernées `UNAVAILABLE`, renseigne `unavailableReason/unavailableAt` et inscrit
un audit. Le gestionnaire générique d'échec ne doit pas écraser cet état par
`ANALYSIS_FAILED`.

### Confidentialité des rapports

Une politique partagée détermine si un rapport est visible à la famille. Les
pages parent et élève filtrent les soumissions avant calcul des totaux et rendu.
Les composants appliquent aussi la politique comme défense secondaire.

| Audience | `COACH_ONLY` | `COACH_AND_STUDENT` | `STUDENT_SUMMARY_ONLY` |
| --- | --- | --- | --- |
| Élève | aucune carte, donnée ou lien | aperçu autorisé et lien complet | `studentSummary` seulement, sans diagnostic ni lien complet |
| Parent/tuteur | aucune carte, donnée ou lien | aperçu autorisé et lien complet en qualité de représentant légal | `studentSummary` seulement, sans diagnostic ni lien complet |

Cette PR n'élargit aucune visibilité et ne crée pas de nouvelle page de rapport.
Elle supprime la fuite `COACH_ONLY` et garantit que le résumé restreint ne réutilise
jamais le rendu du diagnostic complet.

### Contrat du statut indisponible

`UNAVAILABLE` est terminal pour le flux NPC courant. Les routes d'ajout,
suppression, reclassification, génération et relance répondent 409 et ne changent
aucune ligne. La liste coach affiche « Indisponible » et le motif interne, sans
bouton de rapport, génération ou relance. Les listes et compteurs parent/élève
excluent entièrement ces soumissions. Le worker préserve cet état dans tous ses
gestionnaires d'échec.

### Type de document explicite

Les deux frontières d'upload existantes — création historique d'une soumission
avec fichier et ajout de pièces à une soumission — renvoient 400 si
`documentType` manque. La première exige explicitement `STUDENT_COPY`; la
seconde accepte un type canonique choisi. Dans l'interface coach, chaque nouveau
fichier commence sans type sélectionné et ne peut pas être envoyé avant un choix
humain.

Le défaut PostgreSQL historique `STUDENT_COPY` reste présent uniquement parce
que la migration est imposée strictement additive. Aucun chemin applicatif ne
s'en remet à ce défaut : un test d'architecture couvre toutes les créations de
`CopyPage`. Sa suppression fera l'objet d'une migration contractuelle séparée si
le responsable autorise ultérieurement un changement non additif.

### Tombstone opérationnel

La migration ajoute uniquement :

- `UNAVAILABLE` aux statuts de soumission et de pièce ;
- `unavailableReason` et `unavailableAt` aux deux modèles ;
- `sha256` sur la pièce, nullable pour compatibilité avec l'historique, avec une
  contrainte de format lorsqu'il est présent.

La commande reçoit obligatoirement : identifiant de soumission, nombre exact de
pièces attendu, identifiant/statut/visibilité attendus du rapport, statut initial
attendu de la soumission, motif, acteur responsable et destination d'export. Pour
le pilote, l'opérateur devra donc fournir explicitement le rapport
`DRAFT/COACH_ONLY` et la soumission `COMPLETED`; aucune de ces valeurs métier ni
aucun identifiant n'est codé dans le programme. Elle refuse les chemins d'export
non absolus et les périmètres ambigus. Elle exige d'être exécutée comme root et
une destination hors dépôt et hors release, dans un répertoire existant
appartenant à root sans droits groupe/monde. Elle refuse les liens symboliques et
n'écrase jamais un fichier existant.

Le JSON est une enveloppe versionnée contenant : paramètres de l'opération,
horodatage, soumission complète, quatre pièces avec métadonnées, rapport intact,
job lié et audits NPC existants. Les utilisateurs et secrets d'authentification
ne sont pas exportés. L'enveloppe porte le SHA-256 d'un payload sérialisé de
façon déterministe. Le fichier est créé avec `O_EXCL|O_NOFOLLOW`, mode `0600`,
vidé sur disque, relu, reparsé et ré-haché avant toute validation métier.

Ordre d'exécution :

1. ouvrir une transaction et verrouiller, sans encore interpréter, la ligne
   ciblée et ses lignes liées ;
2. construire depuis ces lignes l'export préalable sans secrets ;
3. créer puis vérifier physiquement le JSON `0600` ;
4. vérifier l'identifiant, le rapport attendu et exactement quatre pièces à la
   fois depuis le snapshot relu et depuis les lignes toujours verrouillées ;
5. poser le tombstone sur exactement une soumission et exactement quatre pièces ;
6. inscrire exactement un nouvel audit DB ;
7. vérifier les nombres de lignes et valider la transaction.

La transaction ne modifie ni le rapport, ni le job, ni un autre dossier, ni les
octets sur disque. Si elle échoue après création de l'export, aucune ligne n'est
modifiée et l'export reste comme preuve de tentative. Si l'export échoue, aucune
mutation DB n'est tentée.

Une seconde exécution avec les mêmes arguments et le même export vérifié retourne
`already-applied` uniquement si : la soumission et exactement quatre pièces sont
`UNAVAILABLE`, le motif est identique, les cinq horodatages concordent, et il
existe exactement un audit déterministe correspondant. Un état partiel, un motif
différent, un tombstone provenant d'un autre flux, un audit absent ou surnuméraire
fait échouer la commande sans écriture.

Un export valide laissé par une tentative dont la transaction DB a échoué peut
être repris : la commande le relit, vérifie son empreinte et exige que les lignes
verrouillées correspondent encore exactement au snapshot avant de poursuivre.
Deux commandes concurrentes sont sérialisées par le verrou de soumission. Après
le commit de la première, la seconde valide l'état idempotent et retourne sans
créer son éventuelle autre destination d'export; toute divergence échoue.

## Persistance entre releases

Un test d'intégration crée une racine partagée éphémère, extérieure à deux faux
répertoires de release. Il écrit avec la première release simulée, change de
répertoire courant, relit avec la seconde et compare contenu, taille et
empreinte. Le test échoue si le stockage dépend à nouveau de `cwd`.

## Tests

- résolution et garde fail-closed de la racine ;
- contrat de démarrage application et worker ;
- persistance réelle entre deux releases simulées ;
- SHA-256 enregistré à l'upload ;
- fichier absent, taille différente, empreinte différente ;
- aucun passage `COMPLETED` ni création de rapport en cas d'indisponibilité ;
- absence de lien et d'aperçu `COACH_ONLY` pour parent et élève ;
- résumé seul sans lien ni diagnostic pour `STUDENT_SUMMARY_ONLY` ;
- statut `UNAVAILABLE` traité explicitement par routes, listes et compteurs ;
- courses tombstone contre ajout/suppression/reclassification d'une pièce, et
  finalisation contre suppression, avec preuve du verrou commun ;
- refus d'un upload sans type ;
- migration additive sur PostgreSQL éphémère ;
- commande réelle sur clone : export `0600`, périmètre exact, refus d'une
  divergence, dossiers témoins inchangés et idempotence stricte ;
- suite complète, intégration, base réelle, concurrence, E2E, lint, typecheck,
  build, scan sécurité et garde anti-quarantaine.
- scan de sécurité et test d'architecture sur le dépôt final : aucun chemin NPC
  concret, ancienne variable, repli de stockage, secret ou identifiant de dossier
  pilote ne subsiste dans le code et la configuration de déploiement actifs.

## Risques et limites

- Une empreinte absente sur une pièce historique est un défaut d'intégrité : le
  worker refuse de la finaliser plutôt que d'inventer une référence de confiance.
- Le système de fichiers et PostgreSQL ne partagent pas une transaction. L'export
  est donc écrit et vérifié avant toute mutation DB; une erreur DB laisse un
  export surnuméraire, jamais un tombstone sans export.
- Le déploiement devra fournir et préparer `NPC_STORAGE_ROOT` avant le premier
  démarrage. Le garde est volontairement bloquant.

## Hors périmètre

- Exécution du tombstone en production.
- Déplacement ou suppression des fichiers historiques.
- Modification du scoring, de l'append-only des bilans, du candidat libre, de
  l'activation LLM, du middleware ADMIN ou de #108.
- Activation du LLM : les validations s'exécutent avec `NPC_LLM_MODE=off`.
- Mutation du contenu, du statut ou de la visibilité du rapport pilote.
