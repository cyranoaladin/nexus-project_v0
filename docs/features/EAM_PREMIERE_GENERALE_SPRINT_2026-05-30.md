# Feature - Sprint EAM Maths Premiere generale

## Resume

- Objectif : preparation intensive a l'epreuve anticipee de mathematiques du 8 juin 2026.
- Public : eleves de Premiere generale, specialite mathematiques.
- Epreuve : 2h, sans calculatrice, QCM + exercices.
- Duree : 10h d'accompagnement, 5 seances de 2h.
- Date : lancement samedi 30 mai 2026, 10h30.
- Dashboard : `/dashboard/eleve/eam` (route canonique existante).

## Sources analysees

- Drive : dossier utilisateur, sujets blancs Nexus, bareme, bilans anonymises, automatismes, traces du stage de printemps.
- Code : module EAM historique, dashboard eleve, automatismes, tests EAM existants.
- Bilans : erreurs de finition, domaines de fragilite, redaction.
- Baremes : priorite QCM, exercices ouverts, total 20 points.

## Parcours 10h

| Seance | Objectif | Competences | Travail maison |
|---|---|---|---|
| 1 | Diagnostic express et automatismes | QCM, strategie, redaction | 10 automatismes + fiche erreurs |
| 2 | Fonctions et derivation | derivee, variations, extrema | tableau borne + conclusions |
| 3 | Suites et evolutions | coefficients, seuils, suites | seuil + taux reciproques |
| 4 | Probabilites et variables aleatoires | arbres, conditionnement, esperance | arbre + interpretation |
| 5 | Sujet blanc strategique | temps, ordre, relecture | checklist finale |

## Dashboard

- Route :
  - `/dashboard/eleve/eam`
- Composants :
  - `components/EAMPrep/index.tsx`
  - `components/EAMPrep/StagePanel.tsx`
  - `components/EAMPrep/Livret.tsx`
  - `components/EAMPrep/PlanTimeline.tsx`
- Contenus :
  - plan dynamique J-X ;
  - stage 10h ;
  - mission du jour ;
  - travail inter-seances ;
  - protocole week-end ;
  - livret imprime depuis les donnees EAM partagees.

## Livret

- Sections :
  - objectif de l'epreuve ;
  - points a securiser ;
  - planning des 10h ;
  - automatismes ;
  - fonctions et derivation ;
  - suites et evolutions ;
  - probabilites ;
  - methode sujet blanc ;
  - erreurs frequentes ;
  - week-end final ;
  - checklist veille d'epreuve.
- Usage : consultable dans le dashboard, structure pour impression, lisible sans accompagnement.

## Tests

- `__tests__/eam-premiere-generale/core.test.ts`
- `__tests__/eam-premiere-generale/dashboard.test.tsx`
- `__tests__/eam-premiere-generale/livret.test.tsx`

## Non effectue

- pas de modification Prisma ;
- pas de migration ;
- pas de comptes ;
- pas de modification d'environnement ;
- pas de deploiement ;
- pas de changement du backend rate limiting.

## Deploiement

- Statut : non deploye.
- Recommandation : deploiement exceptionnel possible uniquement apres validation humaine, avec backup, tests serveur, build, reload controle et rollback prepare.
