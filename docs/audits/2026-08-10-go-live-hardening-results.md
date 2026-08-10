# Durcissement du gate go-live — rapport de preuve

## Date

10 août 2026

## Contexte

Le banc post-#116 ne permettait pas une mesure fiable : le seed E2E pouvait
laisser démarrer une application sans comptes, pytest collectait des modules
avant la production de son snapshot et 51 marqueurs de quarantaine
inconditionnelle cachaient des scénarios. Le rattachement tardif à un parent
existant laissait en outre le compte parent source sans état de fusion
explicite.

Cette branche ne modifie ni ne déploie la production. Toutes les migrations et
toutes les écritures de test ont été exécutées sur des services jetables.

## Décisions prises

### Banc hermétique

- le lancement E2E est désormais bloquant et ordonné : migrations, seed,
  vérification des neuf identités attendues, puis démarrage de l'application ;
- le manifeste de comptes reste dans un volume privé partagé et n'est plus
  copié dans l'arbre source ;
- le seed et ses helpers utilisent les modèles et alias TypeScript réellement
  disponibles dans l'image ;
- le snapshot pytest est régénéré par `conftest.py` avant chaque collecte ; un
  artefact déjà présent n'est jamais considéré comme une preuve fraîche ;
- un garde analyse tous les fichiers suivis et interdit les quarantaines
  inconditionnelles, les `todo` et les focus exclusifs.

### Tombstone parent additif

La migration `20260810130000_add_parent_merge_tombstone` ajoute
`mergedIntoUserId`, `mergedAt`, l'index de recherche et la clé étrangère
restrictive. Lors d'un rattachement à un parent existant, la transaction :

1. rattache tous les élèves au profil cible ;
2. synchronise les consentements sans effacer l'historique ;
3. conserve le compte et le `ParentProfile` sources ;
4. pose le tombstone, neutralise l'authentification source et incrémente la
   version de session ;
5. ne modifie aucun bilan, snapshot de score, réponse, provenance ou rendu
   immuable.

Le test PostgreSQL réel compare le graphe avant/après : le profil source existe
toujours mais ne possède plus d'enfant, le profil cible possède l'enfant, le
lien source est révoqué, le lien cible est en attente de consentement et le
snapshot complet du bilan est strictement identique.

Le téléphone conservé sur le compte source reste un alias de détection après
fusion : une nouvelle saisie portant ce numéro suggère le compte cible actif et
ne recrée pas silencieusement un foyer.

### PDF Parent canonique

L'ancienne URL reste disponible. Sur `origin/main`, son module de compatibilité
transformait déjà le bilan historique en HTML avant de déléguer au moteur
HTML→PDF. Cette branche conserve exactement cette transformation dans un
adaptateur et formalise `renderParentHtmlToPdf` comme unique point d'entrée de
production des octets PDF Parent ; elle ne prétend pas retirer un second moteur
PDFKit qui n'existait plus.

Le test d'équivalence fige indépendamment le SHA-256 du HTML historique et ses
contrats d'échappement, de markdown et de marque. Un renderer espion prouve
ensuite que cet HTML exact traverse une seule fois le moteur canonique et que
ses octets sont retournés sans altération. Aucun backfill des anciens bilans
n'est inclus.

### Normalisation et sources de vérité

- `normalizeUserEmail` est l'unique implémentation de la normalisation e-mail ;
  les flux parent, réservation, CRM, activation, seed et scripts la réutilisent ;
- les tarifs et crédits des plans et add-ons de test proviennent du catalogue
  opérationnel ;
- le paiement E2E provient du catalogue de paiement et de la version canonique
  des conditions ;
- le prix attendu du sélecteur provient du catalogue tarifaire canonique ;
- le téléphone public et les mentions juridiques proviennent de `LEGAL`.

Les quatre familles de hardcoding ramenées à leur source sont précisément :

| Ancienne valeur dispersée | Emplacement | Source canonique |
| --- | --- | --- |
| prix et crédits de plans/add-ons | `e2e/helpers/db.ts` et scénarios d'abonnement | `lib/operational-catalog.ts` |
| montant/libellé de paiement et version CGV | `e2e/auth/payments.invoice.documents.spec.ts` | catalogue de paiement et version légale |
| prix attendu du sélecteur | `e2e/auth/price-render-check.spec.ts` | `data/pricing.canonical.json` via son contrat |
| téléphone, identité et e-mail publics | formulaire papier et notice vie privée | `lib/legal.ts` |

Le rendu de la notice candidat libre reste identique et son état dark n'est pas
modifié ; seul le branchement à la source de vérité remplace les littéraux.

## Quarantaines

Le registre détaillé [e2e/QUARANTINE.md](../../e2e/QUARANTINE.md) donne le sort
de chacun des 51 marqueurs retirés. Les scénarios encore valides ont été
réactivés et adaptés au produit courant. Les scénarios de maquette dupliqués ou
obsolètes ont été remplacés par des contrats canoniques vérifiant le même
risque métier, sans nouveau `skip`.

Trois marqueurs conditionnels demeurent dans deux lanes externes non collectés
par le gate hermétique : un lane candidat libre dark exige un état navigateur
fourni, et un lane de recette coach exige des identités et affectations
externes. Ils sont conditionnels, documentés et ne masquent aucun scénario de
la suite officielle. Le gate officiel contient zéro skip.

## Décomptes avant et après

| Lane | Mesure rouge | Preuve finale |
| --- | --- | --- |
| Jest unitaire | 762/764 suites ; 8 508 réussites et 13 échecs sur 8 521 ; 190,415 s | 769/769 suites ; 8 562/8 562 tests ; 189,066 s |
| Jest intégration, base réelle et concurrence | 31/32 suites ; 198 réussites et 3 échecs sur 201 ; 21,794 s. Le premier audit séparé PostgreSQL/concurrence comptait 124 réussites et 54 échecs sur 178 | 32/32 suites ; 201/201 tests ; 25,377 s, dont 15 suites/65 tests PostgreSQL réel et concurrence |
| pytest | 5 erreurs de collecte dues au snapshot absent | 160/160 tests ; 691,39 s |
| Playwright E2E, sans filtre et sans retry | 300 réussites, 242 échecs, 14 non exécutés sur 556 ; 16,1 min. Passage intermédiaire : 477 réussites, 75 échecs, 4 non exécutés ; 20,3 min | 931/931 tests ; 0 échec ; 0 skip ; 15,9 min |

Le total final des quatre lanes officielles est de 9 854 tests réussis, zéro
échec et zéro skip. L'augmentation du nombre de cas Playwright de 556 à 931
vient de la collecte de tous les fichiers hermétiques suivis sous `e2e` et
`__tests__/e2e`, alors que l'ancien runner n'en collectait qu'une partie. Les
anciennes attentes de maquette pré-rentrée ont été portées vers le planning et
le tunnel publics réellement publiés ; aucun fichier fonctionnel hermétique
n'est exclu par une nouvelle règle.

Le build utilisé par la pile E2E a généré 91 pages sous Node 22.23.1 et produit
un artefact standalone valide. L'image Playwright vérifie également Node
22.23.1 et npm 10.9.8 avant d'exécuter les tests. Le contexte Docker exclut les
artefacts de preuve générés et ne transporte aucun fichier runtime local.

La chaîne Prisma a appliqué 70 migrations sur PostgreSQL jetable. Un second
`migrate deploy` n'a trouvé aucune migration en attente et le statut final est
à jour.

## Auth.js

Les erreurs Auth.js de la preuve E2E correspondent uniquement aux scénarios
négatifs nommés : utilisateur inexistant, compte inactif ou pré-activation,
mauvais mot de passe, rôle interdit et interruption réseau injectée. Les
connexions réelles ADMIN, ASSISTANTE, COACH, PARENT et ELEVE réussissent et
établissent une session vérifiée. Aucun échec Auth.js n'apparaît sur leurs flux
positifs ni dans la fenêtre qui suit ces authentifications.

## Documents hors racine

- les quinze PDF de facture sont conservés définitivement conformément à la
  décision du responsable ; aucun n'a été modifié ou déplacé ;
- les quatre pseudo-PDF de test restent en place. Leur suppression est proposée
  dans un lot ultérieur, uniquement après confirmation explicite ;
- aucun des dix-neuf fichiers concernés n'est touché par cette PR.

Le credential bootstrap historique présent dans les métadonnées d'une ancienne
image reste un chantier opérationnel distinct nécessitant une recréation
encadrée. Cette PR n'agit pas dessus.

## Fichiers modifiés

Les changements se répartissent entre le bootstrap et les fixtures E2E, les
tests réactivés, le service de contact parent, le schéma et la migration Prisma,
l'adaptateur de PDF Parent, le normaliseur e-mail, les sources de vérité et les
gardes statiques. Le détail exhaustif reste celui de la diff de la PR.

## Tests exécutés

- suites Jest unitaires, intégration, PostgreSQL réel et concurrence ;
- suite pytest complète ;
- suite Playwright officielle complète sur stack jetable, sans filtre, retry
  ni service externe ;
- migration complète, second passage idempotent et statut Prisma ;
- build Next.js et audits de l'artefact standalone ;
- lint, typecheck, contrôles de hardcoding, quarantaine et sécurité dépôt.

## Résultats

Le gate fonctionnel est vert. La production, le scoring, les snapshots
immuables, le middleware ADMIN, le candidat libre dark et le mode LLM off sont
inchangés.

## Risques restants

- les deux lanes externes conditionnels ne font pas partie du gate hermétique ;
- les quatre pseudo-PDF attendent une décision explicite de suppression ;
- le nettoyage du credential bootstrap historique reste hors périmètre ;
- aucun backfill de bilan historique n'a été réalisé, conformément à la
  décision du responsable.

## Rollback

La branche peut être abandonnée sans impact externe. Après une intégration
future, l'application peut revenir au commit précédent ; la migration additive
peut rester en place sans être utilisée par l'ancien code.
