# Autorité familiale avant les listes parent

Date : 4 octobre 2026. Base publiée : 91161a7cf. Statut global : NOT_READY.

## Défaut et correction

Les GET children et subscriptions chargeaient les informations des enfants à partir du seul Student.parentId historique. Dans les modes Core, cela contournait une révocation ou un lien non vérifié. Six tests rouges prouvent les lectures sans consultation d’autorité et les pannes rendues comme 200.

Un helper partagé charge uniquement les identifiants Student/User/parent puis applique authorizeParentStudentRecords(read). Une panne d’autorité ferme la réponse en 503, les enfants refusés sont omis sans lecture de détails. Les IDs autorisés sont injectés dans le WHERE Prisma de la seconde requête, jamais filtrés après lecture ou pagination. Les listes restent limitées au profil parent côté serveur. La projection children ne charge plus les mots de passe/utilisateurs complets ni les coordonnées des coachs : seulement les champs affichés et les identifiants de séances pour leur comptage.

## Preuves

- Rouge : 6 échecs sur 6.
- Vert élargi : 12 suites / 72 tests ; trois fixtures legacy ont été enrichies des identifiants réellement sélectionnés, sans assertion supprimée.
- Preuves privées : .artifacts/recovery/parent-list-family-*-private.log.
- Aucun tarif, permission financière, lien familial ou source de données commerciale modifié. Aucune migration.

## Limites

Le discovery de ces deux routes reste fondé sur les candidats legacy du profil parent. Un responsable nouvellement vérifié uniquement dans Core doit utiliser le parcours Core ; le discovery unifié reste à achever. Les modes V1_ONLY/HYBRID non migré conservent leur contrat LEGACY_ALLOWED explicite : VERIFIED universel n’est pas revendiqué. PostgreSQL/E2E et CI du prochain SHA restent à qualifier. Aucun déploiement effectué.
