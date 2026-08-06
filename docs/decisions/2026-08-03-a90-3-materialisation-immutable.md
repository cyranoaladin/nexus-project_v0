# A90.3 — Matérialisation immuable des bilans publiés

## Date

2026-08-03

## Contexte

`ReportArtifact` est l’agrégat historique d’une tentative et existe avant publication. Le rendu visuel A90.2 ne doit ni redéfinir cet agrégat, ni être recalculé lors d’une lecture publique.

## Décisions prises

- `ReportArtifact` et `ReportRevision` conservent leur sémantique.
- Une `ReportMaterialization`, unique par révision, porte la version de marque, l’empreinte globale et la date de matérialisation.
- Trois `ReportAudienceArtifact`, uniques par matérialisation et audience, portent le HTML, le PDF éventuel, son statut et une empreinte de contenu.
- Les deux nouvelles tables sont protégées contre `UPDATE` et `DELETE` en PostgreSQL. Une correction produit une nouvelle révision.
- Chromium rend les trois audiences hors transaction. Une transaction finale courte revérifie l’éligibilité, insère les artefacts et publie atomiquement.
- Une erreur HTML interdit la publication. Une indisponibilité PDF conserve le HTML et produit le statut explicite `UNAVAILABLE`.
- La prévisualisation coach est non officielle et non persistée. La route publique lit exclusivement une matérialisation existante.

## Dette acceptée

Pour août 2026, les PDF sont stockés en `BYTEA` PostgreSQL. Le passage à un stockage objet immuable, référencé par checksum depuis PostgreSQL, devra être instruit avant l’augmentation significative du volume de bilans.

## Sécurité

Les contrôles d’audience restent inchangés. Les artefacts publics sont vérifiés avant insertion et leur checksum est revérifié à la lecture. Une matérialisation absente ou altérée produit un refus fail-closed, jamais une régénération.

## Rollback

La migration est additive. Tant qu’aucun feature flag n’est activé, le rollback applicatif consiste à revenir avant A90.3 ; les nouvelles tables peuvent rester inutilisées. Aucune suppression de schéma n’est incluse dans ce lot.
