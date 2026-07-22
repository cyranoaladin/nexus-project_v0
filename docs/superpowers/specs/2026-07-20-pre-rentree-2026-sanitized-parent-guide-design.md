# Pré-rentrée 2026 — Release candidate assainie et Guide Parents

**Date :** 20 juillet 2026  
**Dépôt :** `cyranoaladin/Nexus`  
**PR :** `#1`  
**Statut :** architecture approuvée, implémentation autorisée

## Objectif

Transformer la chaîne documentaire Pré-rentrée 2026 en une release candidate maintenable et reproductible. Le Guide Parents complet devient le point d’entrée éditorial. Les six brochures existantes restent des annexes générées. Les binaires, rasters, copies de sources et paquets sont produits localement ou en CI, jamais suivis dans Git.

## Invariants de gouvernance

- La PR reste en brouillon et n’est ni fusionnée ni déployée.
- La diffusion aux familles n’est pas autorisée par la génération technique.
- Aucune identité ni décision humaine n’est préremplie.
- Les validations propriétaire, juridique et confidentialité restent `PENDING`.
- Le paquet contractuel privé reste `BLOCKED` et aucun PDF privé n’est produit.
- Une modification d’un artefact invalide toute décision liée à une empreinte antérieure.

## Architecture des sources

L’ordre de vérité est explicite et conflictuel, jamais implicite :

1. `data/campaigns/pre-rentree-2026.json` pour la campagne ;
2. `content/pre-rentree-2026/modules.json` pour les programmes ;
3. `data/pricing.canonical.json` et les dérivations tarifaires pour les packs ;
4. `lib/legal.ts` pour l’identité et le contact publics ;
5. `content/pre-rentree-2026/parent-guide.fr.json` pour la structure éditoriale sourcée ;
6. les sources approuvées de conformité, lorsqu’elles existeront.

Le compilateur TypeScript valide ces sources par des schémas fermés et produit un unique contrat JSON consommé par Python. Le renderer n’accède jamais directement aux fichiers métier et ne contient aucune date, valeur tarifaire, capacité, horaire, coordonnée ou promesse métier littérale.

## Contrat éditorial du Guide Parents

`parent-guide.fr.json` distingue :

- les blocs `EVIDENCED_TEXT`, dont chaque affirmation possède des `evidenceRefs` valides vers le snapshot ;
- les blocs éditoriaux de navigation, qui structurent la lecture sans introduire de fait métier ;
- les références de capacités Parcours 360, autorisées publiquement uniquement si `PUBLICLY_COMMITTED=true`.

Le Guide Parents comporte une couverture familiale, un sommaire, une synthèse, la méthode, une lecture par niveau, les douze modules et soixante séances, deux lectures du planning, les tarifs, la procédure de pré-inscription, les informations pratiques, la FAQ et un appel à l’action final. Les tableaux de séances sont remplacés dans le guide par des cartes lisibles. Les annexes conservent leurs usages spécialisés.

## Parcours 360

Une matrice documente séparément `DESIGNED`, `IMPLEMENTED`, `TESTED`, `OPERATIONALLY_READY`, `OWNER_APPROVED` et `PUBLICLY_COMMITTED`. La branche courante contient une conception et un scaffold séparé non intégré ; elle ne prouve pas la disponibilité opérationnelle des quatre documents personnalisés ni des douze tests disciplinaires.

Le Guide Parents se limite donc au vocabulaire déjà approuvé : positionnement, objectifs de travail, travail guidé, évaluations rapides, supports/livrables, synthèse et recommandations. Toute formulation plus forte est rejetée par un test de capacité.

## Sorties et paquets

- `generated/pre-rentree-2026/publication.snapshot.json` est le seul dérivé suivi.
- `.artifacts/pre-rentree-2026/` contient les builds locaux et est ignoré.
- Le paquet parents contient Guide PDF/HTML, six annexes PDF/HTML, assets nécessaires et un court fichier de lecture.
- Le paquet de revue contient le paquet parents, audits, rasters, captures, source map, matrice de capacité, gouvernance et reproductibilité.
- Les ZIP sont publiés par GitHub Actions avec rétention limitée ; aucune release GitHub ni publication automatique n’est créée.

Le générateur ne copie plus son code, ses tests, son CSS, le snapshot ni les polices dans un répertoire `SOURCES`. Les assets canoniques sont copiés uniquement dans le build local. Aucun répertoire `PRIVATE` n’existe dans les sorties.

## Reproductibilité et dates

Le snapshot sépare `sourceRepoSha`, `sourceCommitDate`, `snapshotBuiltAt`, `documentEditionDate` et `documentPackageVersion`. `snapshotBuiltAt` est une valeur versionnée de compilation de release candidate, pas une horloge implicite.

Les PDF sont produits avec un `SOURCE_DATE_EPOCH` explicite. Les heures réelles `documentsBuiltAt`, `automatedVisualAuditAt` et `assistantVisualReviewAt` vivent dans des rapports externes exclus de la comparaison déterministe. Les dates de revue propriétaire, juridique et confidentialité restent nulles sans action humaine réelle.

## Rendu et accessibilité

La direction artistique est A4 portrait, bleu nuit, ivoire et or discret, avec les couleurs matières comme repères secondaires accompagnés d’abréviations. Le texte principal ne descend pas sous 9,5 pt. Les titres, cartes et tableaux ne sont pas scindés.

Le HTML est autonome dans le paquet, sans JavaScript ni réseau : `lang=fr`, lien d’évitement, landmarks, hiérarchie de titres, tableaux avec en-têtes, focus visible, liens explicites, alternatives textuelles et rendu mobile à 320 px. Le PDF reste textuel et balisé au mieux du moteur, mais aucune conformité PDF/UA n’est revendiquée sans validation veraPDF documentée.

## Frontière public/interne

Les documents opérationnels ajoutés par la PR sont reclassés :

- documentation publique de processus, reformulée sans mention trompeuse « non public » ;
- écarts de conformité publics et génériques sous `COMPLIANCE-GAPS.md` ;
- aucun formulaire nominatif rempli, aucune PII, aucun chemin local, aucun secret ;
- aucun faux dossier privé.

Un audit de tout l’historique de la branche recherche secrets, PII, données sensibles et chemins locaux. Une découverte sensible bloque les pushes et impose rotation/purge ; de simples modèles génériques mal étiquetés sont supprimés normalement sans réécriture d’historique.

## Licences

Les polices canoniques DM Sans, Fraunces et IBM Plex Mono restent dans `app/fonts`. Leurs licences officielles sont conservées dans un emplacement central sans dupliquer les polices. `THIRD_PARTY_NOTICES.md` relie chaque famille au texte de licence et à son usage documentaire. Un contrôle bloque tout embarquement d’une police sans notice.

## CI

`.github/workflows/pre-rentree-documents.yml` dispose uniquement de `contents: read`. Il installe des versions définies de Node, Python et des dépendances système, exécute les tests TS/Python, régénère le snapshot et compare Git, construit deux fois, compare les empreintes, audite contenu/PDF/HTML/visuel/licences/sécurité, produit les deux ZIP et les téléverse comme artefacts.

La CI ne merge, ne déploie, ne publie aucune release et n’approuve aucune gouvernance.

## Tests et critères de fin

Le développement suit RED → GREEN → REFACTOR. Les contrats couvrent les sources, le Guide, la provenance, les capacités, le vocabulaire public, les PDF, le HTML, la reproductibilité, les archives, les licences, l’absence de duplications et la propreté du dépôt.

Le chantier est terminé lorsque les commandes `pre-rentree:*` réussissent, que deux builds sont identiques, que les paquets sont complets, que la CI de la PR est verte, que le worktree est propre et que les statuts de gouvernance restent honnêtes.
