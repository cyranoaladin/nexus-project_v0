-- SSoT des enseignements suivis — étape 2/2.
--
-- Suppression de `students.specialties`, désormais entièrement repris dans
-- `student_academic_enrollments` par la migration précédente.
--
-- Cette étape est DESTRUCTIVE et volontairement séparée : elle ne doit être
-- appliquée qu'après exécution de
-- `scripts/curriculum/verify-legacy-specialties.ts`, qui prouve que toute
-- valeur historique a bien une correspondance, et après contrôle du nombre de
-- lignes reprises. Aucune double-écriture n'est conservée : plus aucun code ne
-- lit ni n'écrit cette colonne à ce stade.

-- DropColumn
ALTER TABLE "students" DROP COLUMN "specialties";
