# Versionnement des programmes

## Périmètre implémenté

La première tranche fournit un registre immuable TypeScript/Zod et un resolver pur. Elle ne crée ni table Prisma, ni matrice de notions, ni route publique.

Fichiers :

- `lib/curriculum/schemas/curriculum.ts`
- `lib/curriculum/registry/math.ts`
- `lib/curriculum/registry/index.ts`
- `lib/curriculum/version-resolution/resolve-curriculum-context.ts`
- `lib/curriculum/index.ts`

## Contrat

Une version de programme porte un ID stable, une version, un statut officiel, matière, niveau, voie, variante, début/fin d'effet, session d'examen optionnelle et au moins une source officielle lorsqu'elle est publiée.

Le resolver reçoit séparément :

- année scolaire cible ;
- niveau suivi et niveau cible ;
- voie cible et voie du prérequis ;
- variante cible et variante du prérequis ;
- matière ;
- session éventuelle.

Cette séparation évite de traiter la spécialité Maths de Première comme si elle avait aussi été le programme de Seconde de l'élève.

## Règles

1. L'année précédente est dérivée d'une année scolaire `YYYY-YYYY` valide et consécutive.
2. Seules les versions officiellement `PUBLISHED` sont résolues.
3. La période d'effet est inclusive.
4. Zéro correspondance produit `CurriculumResolutionError` avec `code=NO_MATCH` et l'étape `PREREQUISITE` ou `TARGET`.
5. Plusieurs correspondances produisent `code=AMBIGUOUS_MATCH`; aucun choix silencieux n'est effectué.
6. Le registre refuse les IDs dupliqués et les plages d'effet qui se chevauchent pour un même quadruplet matière/niveau/voie/variante.

## Cas Maths vérifiés

| Entrée | Programme préalable | Programme cible |
|---|---|---|
| Seconde 2026-2027 | Cycle 4/3e publié en 2020, suivi en 2025-2026 | Seconde GT publié en 2026, applicable en 2026-2027 |
| Première spécialité 2026-2027 | Seconde GT 2019, suivie en 2025-2026 | Première spécialité 2026 |
| Terminale spécialité 2026-2027 | Première spécialité 2019, suivie en 2025-2026 | Terminale spécialité 2019, encore applicable |
| Terminale spécialité 2027-2028 | Première spécialité 2026 | Terminale spécialité 2026, applicable à partir de 2027-2028 |

## Sources officielles

- Éduscol, « Programmes et ressources en mathématiques - voie GT », avril 2026.
- BO n° 14 du 2 avril 2026 et annexes Seconde, Première spécialité et Terminale spécialité.
- Programmes antérieurs : BO spécial n° 1 du 22 janvier 2019 et BO spécial n° 8 du 25 juillet 2019.
- Cycle 4 en vigueur en Troisième en 2025-2026 : BO n° 31 du 30 juillet 2020.
- Nouveau cycle 4 : BO n° 10 du 5 mars 2026, applicable en Troisième à partir de 2028-2029.

Les URLs précises sont conservées dans `registry/math.ts`. Aucun contenu de programme ou compétence n'a été généré à partir de la mémoire du modèle.

## Limites et prochaine tranche

- Les PDF officiels ne sont pas encore archivés localement et leurs checksums ne sont pas renseignés.
- Seule la spécialité Mathématiques est couverte pour Première/Terminale ; enseignement scientifique, complémentaires, expertes, Physique-Chimie, Français, NSI et SNT restent à ajouter.
- Le registre est en mémoire. Une ADR doit décider de la source éditoriale et de la persistance avant migration Prisma.
- Les mappings de compétences existants ne sont pas liés à ces IDs tant qu'ils ne sont pas revus pédagogiquement.
- Le resolver n'est pas encore branché aux définitions ou tentatives de production.

## Tests

- Schémas : années consécutives, sources et publication.
- Registre : présence des transitions, unicité, non-chevauchement.
- Résolution : quatre cohortes de référence, absence de variante et ambiguïté.
