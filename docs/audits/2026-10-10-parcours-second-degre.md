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

- Unitaires : 65 suites liées à l'espace, 1 214 tests, 0 échec (dont 80 vérifications mathématiques indépendantes du contenu et 36 tests de rendu réel des étapes).
- Intégration vraie base (Postgres jetable, 137 migrations) : 11 suites `espace-*.real`, 179 tests, 1 échec **préexistant à l'identique sur `main` 435bcb226 non modifié** (`espace-recursivite.real` attend un catalogue NSI sans « Préparation de l'évaluation », cassé depuis #340 — hors périmètre).
- E2E navigateur (Chromium, artefact de release réel contre pile jetable) : 3/3 — audience par groupe (élève de Terminale : jamais proposé), vérification des réponses (écritures libres, valeur approchée refusée quand l'exacte est demandée, correction détaillée repliable, persistance en base des essais, reprise après rechargement), axe 0 violation et 0 débordement à 360 px sur les 10 étapes.
- Typecheck : 0 erreur sur les fichiers touchés (les erreurs `core-v2/generated` préexistent, client non généré en local).

## Mise en ligne (2026-10-10, autorisée par l'owner)

1. **1er essai de bascule : échec contrôlé.** L'artefact avait été compilé avec l'ancien contrat vidéo (URL Jitsi présente, mode non posé) alors que la prod tourne en `VIDEO_MODE=DISABLED` : le préflight runtime (`lib/env-validation` + `assertStandaloneVideoMode`) a refusé le démarrage, santé 000 → **retour arrière automatique de `switch-release.sh`**, prod re-servie par `435bcb226` (santé 200). Aucune interruption au-delà de la fenêtre de redémarrage. Le dossier `91bef0925-espace-second-degre-20261010T1636Z` reste en place (politique de rétention : jamais de suppression sans second feu vert).
2. **Rebuild conforme** (`NEXT_PUBLIC_VIDEO_MODE=DISABLED`, aucune URL Jitsi, manifeste `VIDEO_MODE: DISABLED`) : source `f829171bc`, `BUILD_ID Uqelh6Pyv8GBMeia27tMb`, revalidé en local (boot propre + e2e 3/3).
3. **Miroir de catalogue** : `provision.ts sync-activities --execute` puis `audit-activities` → `CATALOGUE_DB_SYNC=PASS (11 activités)`.
4. **Bascule** : `switch-release.sh` (flock, CAS sur `435bcb226-golive-20261010`, preflight catalogue PASS, garde, santé **200**, cinq identités concordantes). Release servie : `/var/www/nexus-releases/f829171bc-espace-second-degre-20261010T1652Z`. Rollback armé : `435bcb226-golive-20261010`.
5. **Fumée publique** : `/`, `/offres`, `/bilan-gratuit`, `/espace/connexion`, `/ateliers/poo/`, `/api/health` en 200 ; `/espace/maths/second-degre` et `/espace/maths/fonctions-limites` en 307 vers la connexion (attendu).
6. **Comptes** (`provision.ts apply --adopt`, dry-run relu avant exécution) : groupe `premiere-generale` créé ; compte élève existant **adopté** (identifiant `ahmad.b`, code personnel TEMPORAIRE — l'élève choisit le sien à la première connexion) ; enseignant = compte COACH réel `alaeddine` affecté au groupe en maths (compte inchangé par ailleurs). Code écrit UNE fois dans un fichier 0600 hors dépôt (`~/Documents/Nexus_Conservation/espace-code-ahmad-20261010.txt`) — à transmettre puis détruire. Second dry-run : tout `UNCHANGED`, 0 groupe à créer (idempotence vérifiée). Aucune fumée authentifiée avec le compte réel (le code temporaire est à usage de première connexion de l'élève).

## Risques restants

- Les réponses attendues sont dans le contenu servi au navigateur (limite assumée, identique aux modules existants) : un élève déterminé peut les lire. Acceptable pour un parcours d'entraînement.
- Le contrôle `polynomial` reconnaît toute expression *égale* : il ne vérifie pas qu'une « forme factorisée » est bien un produit (le message de réussite le rappelle).
- Le filtre d'audience ne masque que la liste ; un élève de Terminale qui connaît l'URL peut ouvrir le parcours (sans conséquence).
- Un enseignant (COACH) ne voit le travail d'un élève que s'il est affecté au groupe `premiere-generale` en maths ; un ADMIN voit tout.

## Rollback

Release précédente (`435bcb226-golive-20261010`) ; aucune migration ni écriture de schéma ; la ligne `espace_activities` du parcours et le groupe restent en place, inertes sans le code.
