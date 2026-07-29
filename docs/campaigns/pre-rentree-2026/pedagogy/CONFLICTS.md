# Conflits du corpus pédagogique Pré-rentrée 2026

## Date

29 juillet 2026.

## Conflits de sélection

Aucun conflit de sélection requis ne reste ouvert après comparaison :

- `CONFLICT_REVIEW_REQUIRED` : 0 ;
- `UNCLASSIFIED` : 0 ;
- `PENDING_DEDUPLICATION` dans l'inventaire final : 0.

Les neuf groupes de CPS dont le contenu historique diverge du candidat v3
(quatre français et cinq mathématiques) ne sont pas des conflits silencieusement
écartés. La sélection v3 est justifiée par une validation structurelle PASS, le
rapport QA inventorié et vérifié par SHA-256, et un diff v2 → v3 recalculé :
9 statuts ajoutés, 153 changements d'ordre des propositions, 100 ajouts
`obstacleVise`, une correction du palier `n10-i1` et aucun changement
inattendu. Toute différence hors de cette liste créerait un
`CONFLICT_REVIEW_REQUIRED`. Les variantes antérieures restent
`HISTORICAL_VERSION` ou `DUPLICATE_IDENTICAL` lorsqu'elles sont byte-identiques
entre elles.

Une CPS divergente hors de ces neuf preuves reçoit `computed: false` et reste
en conflit. De même, toute différence entre l'inventaire et l'arbre courant
(ajout, suppression ou changement de type d'un fichier, répertoire ou lien)
arrête la construction avant sélection.

La politique fail-closed interdit tout lien symbolique dans l'inventaire comme
dans l'arbre courant. Cette vérification précède `copytree`, afin qu'une cible
externe ne puisse jamais être suivie pendant l'évaluation fonctionnelle.

## Défaut de layout des outils de séances

Le paquet livré présente un défaut opérationnel prouvé, mais pas un conflit de
sélection de contenu :

- état livré : `FAIL_PATH_LAYOUT` ;
- `generate_session_kits.py` et `validate_session_kits.py` cherchent leurs
  entrées et sorties relativement à `outils/`, alors qu'elles sont rangées sous
  `sources/`, `corpus/` et dans un paquet frère ;
- statut de portabilité : `REQUIRES_PATH_ADAPTATION`.

Les deux scripts échouent par `FileNotFoundError` dans une copie temporaire
fidèle du paquet livré. Dans une copie temporaire au layout attendu, leur
exécution et la validation passent, et les 393 fichiers produits sont
byte-à-byte identiques au corpus importé. Ils restent donc des candidats à
porter, pas des outils directement exécutables depuis le paquet historique.

Toutes ces exécutions sont réalisées deux fois dans des espaces temporaires
distincts et uniquement sous `/usr/bin/bwrap` avec environnement vidé, réseau
isolé, racine en lecture seule, ressources et sorties bornées. Les captures
stdout/stderr sont des fichiers anonymes hôte ; une supervision agrégée impose
64 Mio de workspace, 5 000 entrées de tout type (`DirEntry`, dont FIFO, socket
et device) sans suivi des liens, 32 processus, 1 Gio de RSS et 30 secondes de
CPU. Le pic d'entrées est conservé dans `peak_workspace_entries`. L'absence ou
l'échec du bac à sable ferme la vérification : aucune exécution directe de
repli n'est autorisée.

## Validation pédagogique non déléguable

L'absence de conflit technique ne vaut pas validation pédagogique. Les 17 CPS,
les 85 séances et toute sortie qui en dérive restent
`HUMAN_VALIDATION_REQUIRED`. Une relecture pédagogique nominative est requise
avant tout statut `CLASSROOM_READY`, toute utilisation en classe ou toute
publication. Aucune approbation n'est inférée du rapport QA historique.

## Blocage volontaire : Physique-Chimie Seconde

Le module `seconde-physique-chimie` est absent du catalogue canonique des 17
modules et du corpus historique. Son statut est `INTENTIONALLY_BLOCKED`.

Ce manque n'est pas transformé en conflit de fichiers et aucun module n'est
créé implicitement. Une décision produit et pédagogique explicite, suivie d'une
source et d'une validation humaines, serait nécessaire pour étendre le
périmètre.

## Portée

Ce document recense uniquement les conflits réels de sélection. Les besoins de
validation humaine et le module absent sont des garde-fous de gouvernance, pas
des prétextes pour classer artificiellement des fichiers comme conflictuels.
