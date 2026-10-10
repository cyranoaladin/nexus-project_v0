# Parcours « Le second degré » (Première générale) — espace pédagogique

## Date

2026-10-10

## Contexte

Demande : cartographier `/espace`, ouvrir un compte pour un élève de Première générale et lui construire un parcours complet en ligne sur les polynômes du second degré (racines, équations, inéquations, somme et produit des racines, variations, petits problèmes), avec vérification des réponses par l'élève.

Cartographie de `/espace` (code de `main` = `435bcb226`, servi en production) :

| Zone | Routes | Accès |
|---|---|---|
| Connexion | `/espace/connexion` (identifiant + code personnel ; enseignant : mot de passe) | public |
| Élève | `/espace/eleve` (accueil), `/espace/eleve/matieres`, `/espace/eleve/travaux`, `/espace/eleve/compte` | rôle ELEVE |
| Parcours guidés | `/espace/nsi/{poo,structures-lineaires,recursivite,entrainement-evaluation}`, `/espace/maths/{fonctions-limites,suites}`, **`/espace/maths/second-degre`** (nouveau), `/espace/bilan/[level]` | ELEVE inscrit à la matière |
| Enseignant | `/espace/enseignant/{eleves,seances,a-corriger,corriger/[workId],bilans,ressources,archives-poo,compte}` | COACH (ses groupes) ou ADMIN |
| API | `/api/espace/*` (travaux, sauvegarde à révision optimiste, remise, annotations, ressources) | session NextAuth `espace` |

Contenu pédagogique = JSON versionné (`content/espace/<module>/content.json`, généré par `generate.py`) ; la base ne porte que le miroir `espace_activities`.

## Problèmes observés

1. Le vérificateur de réponses (`lib/espace/answer-check.ts`) ne savait lire que nombres, limites, équations de droite et texte : impossible de vérifier un ensemble de racines, une réunion d'intervalles ou une expression développée/factorisée/canonique.
2. Aucune correction détaillée après une réponse fausse (uniquement un message d'aide).
3. Un élève inscrit en maths voit tous les modules de maths : un parcours de Première apparaîtrait à la classe de Terminale.

## Décisions prises

- **Nouveaux types de réponse** : `polynomial` (toute écriture équivalente, lecteur strict `lib/espace/poly-parse.ts` : pas de multiplication implicite après un chiffre, `√` d'une constante positive seulement), `set` (racines, `∅`, valeurs exactes avec `√`, tolérance aux formats `S={…}`, `x₁=… et x₂=…`), `interval` (réunions, crochets ouverts/fermés, `ℝ`, `∅`, `∞` toujours ouvert). Une valeur approchée n'est **pas** acceptée quand la valeur exacte est demandée (message ciblé).
- **Correction détaillée** (`solution`) : repliable (`<details>`), proposée après une réponse fausse seulement ; la réponse juste porte déjà le raisonnement.
- **Audience par groupe** (`ActivityDef.groupSlugs`) : le parcours n'est *proposé* qu'aux élèves inscrits en maths dans le groupe `premiere-generale`. Ce n'est pas un contrôle d'accès (l'inscription à la matière reste le critère d'ouverture) ; aucune migration.
- **Pas de nouveau type d'activité en base** : `RESOURCE_PACK`, comme « Fonctions et limites » ; aucune ressource privée (pas de corrigé PDF : les corrections sont dans le parcours).
- **Contenu** : 10 étapes, 104 min (9 obligatoires + 1 approfondissement) — reconnaître un trinôme (diagnostic) ; racines et factorisation ; équations (discriminant) ; signe et inéquations ; somme et produit ; forme canonique, sommet et variations ; problèmes 1 (aire maximale, entiers consécutifs, chemin) ; problèmes 2 (balle lancée, bénéfice) ; fiche de synthèse imprimable ; équations bicarrées (facultatif). 48 champs vérifiables avec messages ciblés sur les erreurs types et correction détaillée, 13 QCM avec explication par choix, 4 figures (paraboles).

## Fichiers modifiés

- `lib/espace/answer-check.ts`, `lib/espace/poly-parse.ts` (nouveau)
- `lib/espace/catalog.ts`, `lib/espace/lesson-routes.ts`, `lib/espace/overview.ts`
- `components/espace/student/LessonWorkbench.tsx`
- `app/espace/maths/second-degre/page.tsx` (nouveau)
- `content/espace/maths-second-degre/{generate.py,content.json}` (nouveau)
- Tests : `__tests__/lib/espace/{answer-check-second-degre,maths-second-degre-content,second-degre-audience}.test.ts`, `__tests__/components/espace-student/{SecondDegreLesson,LessonWorkbench}.test.tsx`, `e2e/auth/espace-second-degre.spec.ts`

## Tests exécutés

- **Réponses recalculées indépendamment** (`maths-second-degre-content.test.ts`) : Δ, racines, sommets, extrema, images d'intervalle, aires, instants, bénéfices recalculés dans le test (sans relire le texte du contenu), études de signe vérifiées par échantillonnage fin, absence d'autre racine pour les équations bicarrées. Chaque « erreur type » déclarée ne doit jamais être une bonne réponse.
- **Rendu réel de chaque étape** (`SecondDegreLesson.test.tsx`) : formules KaTeX sans reste de délimiteur, chaque champ accepte sa bonne réponse *tapée comme un élève*, chaque réponse fausse ouvre une correction.
- Unitaires `__tests__/lib/espace` + `__tests__/components/espace-student` : voir le rapport final de session (résultats en bas).

## Résultats

Voir « Mise en ligne » ci-dessous.

## Risques restants

- Les réponses attendues sont dans le contenu servi au navigateur (limite assumée, identique aux modules existants) : un élève déterminé peut les lire. Acceptable pour un parcours d'entraînement.
- Le contrôle `polynomial` reconnaît toute expression *égale* : il ne vérifie pas qu'une « forme factorisée » est bien un produit (le message de réussite le rappelle).
- Le filtre d'audience ne masque que la liste ; un élève de Terminale qui connaît l'URL peut ouvrir le parcours (sans conséquence).
- Un enseignant (COACH) ne voit le travail d'un élève que s'il est affecté au groupe `premiere-generale` en maths ; un ADMIN voit tout.

## Rollback

Release précédente (`435bcb226-golive-20261010`) ; aucune migration ni écriture de schéma ; la ligne `espace_activities` du parcours et le groupe restent en place, inertes sans le code.
