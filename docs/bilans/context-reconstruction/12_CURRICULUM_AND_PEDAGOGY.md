# Curriculum et pédagogie

## Registre nécessaire

Une version de curriculum est identifiée par matière, niveau, voie, variante/spécialité/option, année d'effet, cohorte, session d'examen, statut, sources officielles archivées et checksums. Une tentative snapshotte le programme préalable effectivement suivi et le programme cible ; les deux peuvent différer de la seule classe affichée dans le profil.

Le registre est serveur, borné et auditable. Une année hors horizon vérifié répond `UNKNOWN_CURRICULUM`, jamais « dernière version connue pour toujours ». Les définitions non compatibles restent indisponibles avec une raison explicite.

## Faits réglementaires recoupés

Éduscol indique que les nouveaux programmes de mathématiques du lycée, publiés au BO du 2 avril 2026, s'appliquent en Seconde et Première en 2026-2027 puis en Terminale en 2027-2028 : `https://eduscol.education.gouv.fr/5817/programmes-et-ressources-en-mathematiques-voie-gt`.

Le nouveau programme de mathématiques du cycle 4, BO du 5 mars 2026, s'applique progressivement en 5e en 2026-2027, 4e en 2027-2028 et 3e en 2028-2029 : `https://eduscol.education.gouv.fr/5736/ressources-d-accompagnement-du-programme-de-mathematiques-au-cycle-4`.

Ces dates imposent qu'un diagnostic d'entrée en Seconde 2026-2027 utilise encore le programme de Troisième antérieur en prérequis, tandis que le programme cible de Seconde est nouveau. La même cohorte atteint la Terminale selon le calendrier propre à sa version ; aucun « programme courant » global n'est suffisant.

## État du registre local

Le code local non intégré au runtime couvre seulement Mathématiques : Troisième, Seconde, Première spécialité et Terminale spécialité, avec sources URL mais sans checksums des documents. Il ne couvre pas encore les variantes intégrées, technologiques, complémentaires/expertes ni Physique-Chimie, Français, NSI/SNT.

La résolution `2035-2036` a été exécutée localement et retourne les versions 2026 ouvertes, au lieu de refuser l'horizon. Les 15 tests curriculum passent mais ne testent donc pas cette exigence. Ce défaut est P0 avant branchement runtime.

## Matrice pédagogique minimale

| Entrée | Programme préalable | Cible / nuance |
|---|---|---|
| Seconde | Troisième selon calendrier cycle 4 | tronc commun GT ; SNT readiness, pas spécialité NSI |
| Première générale | Seconde + enseignements réellement suivis | tronc/EDS/Maths intégré selon choix |
| Première technologique | Seconde GT | série et mathématiques technologiques spécifiques |
| Terminale générale | Première, spécialités conservées/abandonnées | spécialité/options ; calendrier 2027-2028 |
| Terminale technologique | Première de série | variante de série |
| Français Terminale | acquis de Première/transversal | pas de programme obligatoire autonome à inventer |

## Banques et définitions

Chaque question précise programme/version/source, notion, compétence, prérequis, difficulté attendue, format, barème, durée, erreurs diagnostiques, statut de revue et accommodations. Une question générée par IA n'est jamais publiée automatiquement. Les 15 définitions initiales évoquées par le cahier des charges doivent être construites et revues ; elles ne sont pas présentes comme banque canonique complète.

## Gouvernance

Workflow `DRAFT → PEDAGOGICAL_REVIEW → APPROVED → PUBLISHED → RETIRED`. Deux personnes pour publication structurante, journal, checksum des PDFs officiels archivés et date du dernier contrôle. Une tâche annuelle vérifie l'horizon et ouvre explicitement les années futures. Ne pas connecter ce registre au runtime pendant la reconstruction présente.
