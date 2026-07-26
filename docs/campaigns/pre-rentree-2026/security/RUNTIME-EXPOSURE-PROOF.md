# Preuve d'exposition runtime

## Date

2026-07-26, Africa/Tunis.

## Artefact qualifié

Le build Next.js 15.5.21 a produit un artefact standalone validé :

- 4 444 fichiers ;
- 192,6 Mo ;
- 537 fichiers statiques, identiques entre source et standalone ;
- aucun source map, test, mock, fichier Compose ou configuration sensible ;
- audit des traces Next.js sans référence absente ni sortie de racine.

## Résultats

| Contrôle | Résultat |
|---|---|
| `npm audit --omit=dev --audit-level=high` | 0 high, 0 critical |
| `npm audit --audit-level=high` | 36 high, 0 critical, advisory unique |
| Recherche physique dans `.next/standalone` | 0 occurrence `brace-expansion` |
| CycloneDX runtime 1.6 | 522 composants |
| Composants `brace-expansion` dans le SBOM runtime | 0 |
| Audit de l'artefact standalone | PASS |
| Validation des traces Next.js | PASS |

Les versions vulnérables sont présentes uniquement dans l'environnement
d'installation, de lint et de génération du SBOM. Elles ne traitent aucune
entrée parent sur le serveur public et ne disposent d'aucun secret dans les
jobs qui exécutent les scans.

Cette preuve ne masque pas l'audit complet : elle borne seulement le risque
technique de l'exception temporaire.
