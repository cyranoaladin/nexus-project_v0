# Politique de rétention des releases

## Portée

Cette politique décrit le contrat public sans exposer la topologie réelle. Les
valeurs `<CANONICAL_POINTER>`, `<COMPAT_ALIAS>` et `<RELEASE_ROOT>` sont
renseignées uniquement dans le runbook privé.

Aucune suppression n'est automatique. Un inventaire n'est qu'une proposition
jusqu'au feu vert humain explicite portant sur une liste exacte.

## Releases à conserver

Conserver systématiquement :

- la release active résolue par `<CANONICAL_POINTER>` ;
- les deux derniers SHA distincts antérieurs compatibles avec la version Node
  de production supportée ;
- toute release couverte par un blocage juridique, comptable ou opérationnel ;
- toute release contenant une donnée runtime non répliquée dans un stockage
  durable vérifié.

Une reconstruction supplémentaire du même SHA ne compte pas comme rollback.
Elle peut devenir candidate à la suppression après preuve d'identité des
artefacts et vérification qu'elle ne contient aucune donnée runtime.

Une copie durable protège la donnée, mais ne lève jamais un blocage permanent
prononcé pour une release. Seule une décision humaine explicite peut faire
évoluer un blocage non permanent ; un blocage permanent reste hors de toute
liste de suppression.

## Garde avant toute proposition de suppression

Pour chaque candidate, produire et faire relire les preuves suivantes :

1. elle n'est la cible ni de `<CANONICAL_POINTER>`, ni de `<COMPAT_ALIAS>` ;
2. aucun processus en cours ni configuration persistée ne la référence ;
3. le scan des racines de documents, factures, uploads et rapports ne trouve
   aucune donnée runtime non répliquée ;
4. les chemins enregistrés en base ne la référencent pas ;
5. toute donnée découverte possède une copie durable relue, une empreinte et
   une décision métier explicite ;
6. la liste nominative, l'espace estimé et le rollback conservé reçoivent un
   feu vert humain explicite.

Un seul contrôle rouge bloque la release concernée. Il est interdit de déplacer
ou de supprimer le fichier problématique pour faire artificiellement passer le
scan.

## Séquence de nettoyage autorisée ultérieurement

Après validation humaine seulement :

1. refaire l'inventaire et le garde de pointeurs immédiatement avant l'action ;
2. comparer la liste recalculée à la liste approuvée ;
3. arrêter si un chemin, un SHA, une référence ou un compteur diffère ;
4. supprimer uniquement les répertoires explicitement approuvés ;
5. mesurer l'espace réellement récupéré et refaire les contrôles de santé.

La divergence entre une racine de documents configurée et un répertoire
historique contenant des fichiers relève d'un chantier distinct. Elle ne doit
jamais être corrigée implicitement pendant un nettoyage de releases.
