# NSI Pratique 2026 — Dashboard Coach V2

## Route

`/dashboard/coach/nsi-pratique-2026`

## Données affichées

Le dashboard coach consomme :

`GET /api/coach/nsi-pratique-2026/students`

Il affiche uniquement les élèves assignés au coach avec la matière `NSI`.

Pour chaque élève :

- prénom et nom ;
- présence ou absence d'une progression synchronisée ;
- dernière activité serveur ;
- nombre de sujets maîtrisés ;
- nombre de sujets travaillés ;
- statut synthétique : `Prêt`, `Presque prêt` ou `À consolider`.

## États UI

- Chargement : spinner.
- Erreur API : message d'erreur contrôlé.
- Aucun élève NSI assigné : état vide.
- Élèves assignés : liste de cartes.

## Sécurité

- La route dashboard est protégée par le middleware.
- La page client vérifie aussi le rôle `COACH`.
- L'API filtre par assignations actives via `CoachStudentAssignment`.
- Les données viennent de la progression serveur synchronisée.
