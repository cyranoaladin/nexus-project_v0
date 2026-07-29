# Corpus pédagogique Pré-rentrée 2026

## Verdict de remise

`PASS` pour l'organisation technique du lot 1. L'inventaire des 534 fichiers,
la classification sans conflit, le pipeline reproductible, les suites Python
et TypeScript, `lint`, `typecheck`, les tests Jest globaux, le build de
production et la reconstruction depuis un checkout propre sont verts.

Ce verdict ne constitue pas une validation disciplinaire ou une autorisation
de publication. Les 17 modules restent `HUMAN_VALIDATION_REQUIRED` ; aucune
utilisation en classe ou publication n'est autorisée.

## Périmètre

Le lot 1 couvre uniquement :

- l'inventaire immuable et les empreintes SHA-256 ;
- la classification et la déduplication des quatre paquets reçus ;
- la canonicalisation de 17 CPS et de 85 kits de séance ;
- le portage des générateurs et validateurs ;
- la génération interne sous `.artifacts/pre-rentree-2026/pedagogy/`.

Il n'ajoute aucune interface complète de test, API, bilan applicatif ou
migration Prisma. Il ne publie aucun fichier sous `public/`.

## Repères prouvés

| Domaine | Compteurs |
|---|---:|
| Import historique | 119 répertoires, 534 fichiers, 4 083 588 octets |
| Positionnement | 17 CPS, 141 nœuds, 136 évalués, 408 items, 33 réponses manuelles |
| Séances | 17 modules, 85 séances, 340 fichiers unitaires |
| Exercices | 255 banques A/B/C, 765 exercices et 765 corrigés |
| Fin de séance | 85 exit tickets, 255 questions |
| Sorties reconstructibles reçues | 103 |

## Navigation

- [Sources de vérité](SOURCE-OF-TRUTH.md)
- [Statut des contenus](CONTENT-STATUS.md)
- [Rapport d'import du 29 juillet 2026](IMPORT-REPORT-2026-07-29.md)
- [Rapport de déduplication](DEDUPLICATION-REPORT.md)
- [Conflits et blocages](CONFLICTS.md)
- [Feuille de route des lots suivants](IMPLEMENTATION-ROADMAP.md)

## Commandes

```bash
PRE_RENTREE_PEDAGOGY_IMPORT_ROOT=/chemin/vers/dossiers_tests_prerentree \
  npm run pre-rentree:pedagogy:import-check
npm run pre-rentree:pedagogy:validate
npm run pre-rentree:pedagogy:build
npm run pre-rentree:pedagogy:verify
```

`import-check` est le seul contrôle qui dépend de l'import historique externe.
Les trois autres commandes lisent les sources versionnées et écrivent seulement
sous `.artifacts/pre-rentree-2026/pedagogy/`.

## Sécurité et mineurs

Le corpus versionné ne doit contenir ni identité d'élève, ni donnée de santé,
ni copie nominative, ni secret. Les sorties élève sont contrôlées pour ne pas
exposer réponses, barèmes enseignants ou diagnostics attendus. Toute future
collecte ou restitution applicative devra minimiser les données et appliquer
les contrôles d'accès adaptés aux mineurs.
