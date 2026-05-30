# Roadmap contenus Première STMG

Statut : le module annuel STMG et le cockpit intensif `stage-eam-stmg` sont séparés mais alignés. Le programme annuel reste la source de suivi long cours ; le stage EAM STMG ajoute un parcours commando sans calculatrice, avec persistance serveur scopée dans `diagnostic_results.stage_eam_stmg`.

## Taxonomie Maths STMG

- Automatismes : QCM courts, calcul mental, pourcentages, indices, lectures graphiques.
- Suites numériques : récurrence, tableur, seuil, somme de termes, modèles de gestion.
- Fonctions : formes factorisée/canonique, degré 3, racine cubique, lecture graphique.
- Dérivation : nombre dérivé, tangente, dérivée de polynôme de degré inférieur ou égal à 3, variations, coût marginal.
- Statistiques et probabilités : tableaux croisés, fréquences conditionnelles, Bernoulli jusqu'à 4 répétitions, variable aléatoire, espérance.
- Algorithmique et tableur : formules à étirer, compteur, accumulateur, seuil, simulation simple.

## Surfaces

- Dashboard élève : `app/dashboard/eleve/page.tsx` et `components/dashboard/eleve/TrackContentSTMG.tsx` affichent une seule entrée stage pour les élèves `PREMIERE` avec parcours STMG.
- Programme annuel : `app/programme/maths-1ere-stmg/page.tsx`, API `app/api/programme/maths-1ere-stmg/progress/route.ts`, diagnostics et référentiels dans `lib/diagnostics`, `lib/assessments` et `programmes/`.
- Stage intensif : `app/dashboard/eleve/stage-eam-stmg/**`, `components/stage-eam-stmg/**`, `content/stage-eam-stmg/**`, `hooks/stage-eam-stmg/useStageProgress.ts`.
- Livret stage : route `app/dashboard/eleve/stage-eam-stmg/livret/page.tsx`, contenu issu du cockpit stage.

## Avancées go-live

- Persistance stage : route dédiée `app/api/programme/maths-1ere-stmg/stage-progress/route.ts`, fusion serveur limitée à `diagnostic_results.stage_eam_stmg`, sans réécrire `completed_chapters`, `total_xp`, `badges`, `srs_queue` ni les autres champs programme.
- Anti-clobber : le hook stage ne POST jamais si le chargement serveur initial échoue ; il reste en cache local et signale la synchronisation dégradée.
- Compatibilité progression : l'ancien identifiant `algorithmique-information` est toléré en lecture et migré vers `algorithmique-tableur`.
- Planning adaptatif : les six domaines sont couverts sur le parcours J1-J5.
- Sujet blanc : format officiel voie technologique, 2 h, sans calculatrice, 12 QCM pour 6 points et 3 exercices pour 14 points, correction révélée après soumission.
- Reprise d'erreurs : les QCM ratés alimentent une file de reprise prioritaire dans l'entraîneur.
- Checklist de séance : objectifs validables par l'élève et persistés avec l'état stage.

## À valider humainement

- Justesse pédagogique finale des nouveaux items de sujet blanc avant impression large.
- Liens Drive Nexus à maintenir si les fichiers sources sont déplacés.
- Exécution e2e complète sur environnement de test avec comptes dédiés STMG et non-STMG, sans utiliser de compte élève réel.

## Points de vigilance

- Ne pas réutiliser les barèmes EDS pour STMG.
- Garder le format EAM technologique : 2 h, sans calculatrice, Partie 1 QCM 12 items pour 6 points, Partie 2 exercices pour 14 points.
- Ne jamais écrire la progression stage via un payload programme reconstruit côté client.
- Séparer Français EAF sur `https://eaf.nexusreussite.academy`.
