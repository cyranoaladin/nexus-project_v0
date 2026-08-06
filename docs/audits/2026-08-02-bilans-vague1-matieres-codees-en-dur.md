# Audit des matières codées en dur — banques de positionnement vague 1

## Date

2026-08-02

## Périmètre et commande

Le recensement couvre le pipeline bilans, ses scripts, ses schémas, ses tests, Prisma et
la documentation technique associée. Les domaines métier sans dépendance avec les packs
de positionnement sont signalés séparément et ne sont pas refondus.

```bash
rg -n "MATHS_EXPERTES|MATHEMATIQUES|PHYSIQUE_CHIMIE|PHILOSOPHIE|FRANCAIS|\\bSVT\\b|\\bNSI\\b|\\bMATHS\\b" \
  lib/bilans scripts/bilans data/bilans/schemas __tests__/bilans app/api/bilans \
  components/bilans prisma/schema.prisma docs/specs/bilans
```

## Occurrences exécutables

| Fichier / symbole | Valeurs codées | Qualification | Recommandation, coût et risque |
| --- | --- | --- | --- |
| `data/bilans/schemas/bank.schema.json` / `subject.enum` | MATHS, MATHS_EXPERTES, NSI, PHYSIQUE_CHIMIE, SVT, FRANCAIS, PHILOSOPHIE | Allowlist éditoriale légitime et bloquante. Les six matières de la vague sont couvertes. `MATHS_EXPERTES` préexistait mais aucune banque de la vague ne l'utilise. | Conserver l'allowlist versionnée. Nouvelle matière : modification explicite et test, moins de 0,5 j, risque faible. |
| `lib/bilans/catalog/subjects.ts` / `BILAN_PACK_SUBJECTS` | MATHS, NSI, FRANCAIS, PHYSIQUE_CHIMIE, SVT, SES, PHILOSOPHIE, HISTOIRE_GEOGRAPHIE, GRAND_ORAL | Politique runtime du chargeur, centralisée par ce lot. | Conserver une allowlist explicite ; ne pas accepter une chaîne libre. Coût marginal, risque faible. |
| `lib/bilans/api/create-attempt.ts` / `SUBJECTS` | MATHS/MATHEMATIQUES, NSI, FRANCAIS, PHILOSOPHIE, HISTOIRE_GEO, ANGLAIS, ESPAGNOL, PHYSIQUE_CHIMIE, SVT, SES | Adaptateur nécessaire entre les codes de pack et l'enum Prisma. Les six matières sont couvertes. | Extraire ultérieurement une table de provenance partagée avec tests Prisma : 0,5 j, risque faible à moyen. |
| `lib/bilans/api/get-attempt.ts` / `subjectLabel` | cas MATHS, fallback par remplacement de `_` | Générique mais les libellés non mathématiques restent techniques. | Ajouter une table de libellés UI lors du chantier runner multi-matières : 0,5 j, risque faible. |
| `prisma/schema.prisma` / `enum Subject` | MATHEMATIQUES, NSI, FRANCAIS, PHILOSOPHIE, HISTOIRE_GEO, ANGLAIS, ESPAGNOL, PHYSIQUE_CHIMIE, SVT, SES | Enum de persistance légitime. Les six matières sont couvertes. | Toute extension exige une migration additive éprouvée : 1 j, risque moyen. Aucune migration dans ce lot. |
| `prisma/schema.prisma` / `enum GradeLevel` | TROISIEME, SECONDE, PREMIERE, TERMINALE, POSTBAC, AUTRE | Quatrième n'est pas représentée. Cela ne bloque pas la conversion, mais bloque une future création de passation Quatrième. | Mission Canonical dédiée avec migration additive : 1–2 j, risque moyen. |
| `lib/bilans/api/create-attempt.ts` / `LEVELS` | TROISIEME, SECONDE, PREMIERE, TERMINALE, POSTBAC, AUTRE | Même limite pour Quatrième. | Traiter avec l'enum Prisma, jamais par fallback `AUTRE`. |
| `lib/bilans/core/types.ts` / `CatalogSubject` | MATHEMATIQUES, PHYSIQUE_CHIMIE, NSI, FRANCAIS, SVT, SES | Contrat Canonical historique distinct du format de pack ; PHILOSOPHIE manque. | Harmonisation coordonnée types/schémas/consommateurs : 1–2 j, risque moyen. Hors chemin de conversion. |
| `lib/bilans/core/schemas.ts` / `catalogRefSchema.subject` | mêmes six valeurs | Duplique `CatalogSubject`. | Déduire les deux depuis une politique partagée lors de la mission précédente, sans élargissement implicite. |
| `lib/bilans/catalog/fixtures/maths-nsi.v1.ts` | MATHEMATIQUES, NSI | Fixture historique volontairement limitée. | Ne pas généraliser ; renommer comme fixture historique lors d'un nettoyage, 0,25 j. |
| `__tests__/bilans/fixtures/canonical-worker.ts` | MATHS | Fixture ciblée du worker. | Légitime ; les tests de vague dynamiques apportent la couverture des cinq autres disciplines. |
| `__tests__/bilans/fixtures/recipe-fact-sheets.ts` | domaines historiques Maths | Fixtures de non-régression existantes. Le constructeur est désormais exporté pour les quinze packs. | Conserver les cas dorés et utiliser le constructeur générique pour les nouvelles vagues. |

## Schémas et documentation

- `docs/specs/bilans/01-domaine-et-modele-de-donnees.md` emploie encore l'abréviation
  `PC`, alors que les sources et le runtime utilisent `PHYSIQUE_CHIMIE`. La documentation
  devra être harmonisée sans renommer les données : 0,25 j, risque faible.
- `docs/specs/bilans/03-banque-d-items.md` cite les matières attendues par niveau. C'est une
  couverture pédagogique, non une allowlist exécutable.
- `docs/specs/bilans/08-agents-et-validateurs.md` utilise `MATHS` comme exemple JSON ; aucune
  branche conditionnelle n'en dépend.
- Aucun composant de rendu bilans ne contient d'enum de matière : le rendu consomme la
  FactSheet et reste générique.
- Le convertisseur, le validateur V1–V14, le batch, le dashboard et la recette de vague ne
  contiennent aucune branche par matière ni par slug.

## Domaines extérieurs au pipeline

Les campagnes de prérentrée, le curriculum, les offres et les anciens moteurs Assessment
portent leurs propres listes de matières. Elles ne sont pas des dépendances du batch et les
modifier dans ce lot créerait un risque de régression commerciale. Une convergence globale
des taxonomies est estimée à 3–5 jours, risque élevé, et doit faire l'objet d'une ADR dédiée.
