# Stockage NPC persistant

## Date

11 août 2026

## Contexte

L'application et le worker NPC refusent volontairement de démarrer sans
`NPC_STORAGE_ROOT`. Cette variable désigne l'unique racine des sources NPC. Le
répertoire doit exister avant le démarrage, être persistant, canonique, non
symbolique et situé hors de l'arbre de release actif.

Ce contrat s'applique à tous les environnements. La CI utilise une racine
jetable propre au job ; la production doit utiliser une racine durable préparée
par l'exploitation. Aucun environnement ne bénéficie d'un repli implicite.

## Problèmes observés

- Un environnement propre qui ne préparait pas la racine échouait au démarrage,
  conformément au garde, mais sans que la configuration CI respecte encore ce
  nouveau prérequis.
- Une racine créée dans le checkout ou dans une release disparaîtrait lors de la
  rotation des releases.
- Un montage créé implicitement pourrait masquer une erreur de chemin ou de
  droits et démarrer avec un stockage vide.

## Décisions prises

### Racine et permissions

La valeur d'exploitation est représentée dans ce document par
`<NPC_PERSISTENT_ROOT>`. Elle doit respecter toutes les propriétés suivantes :

- chemin POSIX absolu et résolu canoniquement ;
- répertoire existant avant le démarrage, jamais créé par l'application ;
- aucun symlink sur la racine ;
- aucun recouvrement avec `<RELEASE_ROOT>` ni avec son parent de releases ;
- propriétaire de confiance : `root` ou l'UID effectif du processus ;
- aucune écriture accordée au groupe ou au monde ;
- sauvegarde, rétention et supervision indépendantes des releases.

L'application reçoit `NPC_STORAGE_ROOT=<NPC_PERSISTENT_ROOT>` avec un accès en
lecture-écriture. Le worker reçoit exactement la même valeur avec un accès en
lecture seule lorsque son mode d'exécution permet de restreindre le montage.
Les deux processus utilisent le même UID applicatif de confiance.

Pour un déploiement conteneurisé, le bind mount est explicite, pointe vers la
racine préparée, interdit la création automatique du chemin hôte et est :

- en lecture-écriture pour l'application ;
- en lecture seule pour le worker.

Pour le processus applicatif standalone, la racine reste hors release et est
injectée dans l'environnement persistant du gestionnaire de processus avant le
redémarrage. Une bascule de release ne déplace ni ne remplace cette racine.

### Préflight de déploiement

Avant tout démarrage ou redémarrage, l'opérateur doit vérifier en lecture seule :

1. que `NPC_STORAGE_ROOT` est définie et absolue ;
2. que la racine existe, n'est pas un symlink et se résout hors release ;
3. que le propriétaire et les modes sont conformes ;
4. que l'application peut lire et écrire dans la racine ;
5. que le worker peut lire la même racine sans droit d'écriture si son montage
   est restreint ;
6. que le démarrage échoue bien si la variable est retirée ou invalide.

Le déploiement est bloqué si un de ces contrôles échoue. Il ne faut ni créer de
repli dans le code, ni rendre la variable optionnelle, ni changer le garde.

### CI et tests E2E

Chaque job CI qui démarre l'application crée une racine privée sous l'espace
temporaire du runner, vérifie qu'elle est hors du checkout et exporte ensuite
`NPC_STORAGE_ROOT`. Le compose E2E utilise un stockage nommé propre à la pile
jetable ; sa destruction fait partie du teardown. Ces racines ne sont jamais
partagées avec la production.

Les suites réelles NPC qui exigent UID 0 s'exécutent uniquement dans leur
harness dédié, avec PostgreSQL et stockage jetables, `NPC_LLM_MODE=off` et
nettoyage inconditionnel. Elles restent une composante obligatoire de la lane
d'intégration.

## Fichiers modifiés

- `.github/workflows/ci.yml`
- `docker-compose.e2e.yml`
- `docker-compose.npc.yml`
- `docker-compose.prod.yml`
- `instrumentation.ts`
- `lib/npc/storage-root.ts`
- `services/npc-worker/index.ts`

## Vérifications requises

- contrat d'architecture de la racine, des montages et des démarrages ;
- démarrage standalone dans les jobs Build et E2E ;
- suites NPC réelles dans le harness root-only ;
- scans de sécurité du dépôt et de l'infrastructure publique.

## Risques restants

- Une mauvaise politique de sauvegarde de `<NPC_PERSISTENT_ROOT>` reste un
  risque d'exploitation ; le code ne peut pas prouver la qualité d'une
  sauvegarde externe.
- Le montage lecture seule du worker protège les sources, mais toute évolution
  future qui lui demanderait d'écrire doit faire l'objet d'une nouvelle décision
  explicite, pas d'un assouplissement silencieux.

## Rollback

Une bascule vers la release précédente doit conserver la même racine persistante
et ne doit jamais supprimer son contenu. La migration additive reste en place.
Le rollback applicatif ne déclenche ni tombstone, ni déplacement, ni suppression
de fichier NPC.
