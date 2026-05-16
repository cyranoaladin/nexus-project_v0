# NSI Pratique 2026 — Guide utilisateur

## Élève

Route : `/dashboard/eleve/nsi-pratique-2026`

La page permet de travailler :

- les 23 sujets ;
- les patrons de code ;
- le plan 5 jours ;
- les flashcards ;
- le sujet blanc ;
- l'oral trainer ;
- l'auto-évaluation.

La progression est sauvegardée localement immédiatement, puis synchronisée avec
le serveur quand l'élève est connecté. Le message sous la navigation indique
l'état courant : synchronisé, synchronisation en cours, erreur ou local-only.

En cas d'erreur réseau, la progression reste disponible sur l'appareil via
`localStorage` et sera refusionnée lors d'une session authentifiée suivante.

## Coach

Route : `/dashboard/coach/nsi-pratique-2026`

Le coach voit les élèves NSI qui lui sont assignés et leur résumé de progression
synchronisée :

- dernière activité ;
- sujets maîtrisés ;
- statut global de préparation.

Un coach non assigné à un élève ne peut pas accéder à sa progression.
