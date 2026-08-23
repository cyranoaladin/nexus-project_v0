# Audit du hotfix urgent — saisie papier Mathématiques complémentaires

## Date

23 août 2026 (Africa/Tunis).

## Verdict

`READY FOR URGENT PAPER ENTRY`

Ce verdict porte sur le runtime local vérifié. Aucun déploiement, SSH, push, merge ou changement de variable de production n'a été effectué. Le flag de production est resté inchangé.

## Base et état Git

- Worktree : `/home/alaeddine/Bureau/nexus-project_v0-maths-complementaires-runtime`.
- Branche : `feat/maths-complementaires-runtime-bilans`.
- HEAD testé : `e32137e5371d951d26c21fd90275cacaf32a56da`.
- `origin/main` observé : `4bc6f4ebf165edc88c8f3ac7da405a569e028850` (deux commits candidats/offres sans rapport avec ce hotfix, non intégrés).
- Aucun commit, push, merge ou déploiement.
- `.tmp-mco-ui/` était préexistant et a été préservé.

## Architecture réellement exercée

`Terminale → Mathématiques complémentaires → PaperEntryGrid → POST /api/bilans/saisie-papier → CanonicalAssessmentAttempt(SAISIE_PAPIER) → SCORE_ATTEMPT → FactSheet canonique → GENERATE_REPORT en DETERMINISTIC_FALLBACK → PENDING_REVIEW → prévisualisations ELEVE/PARENTS/NEXUS → validation ASSISTANTE → PUBLISHED`.

La narration familiale LLM a été explicitement absente de l'environnement de test. Le transport LLM espionné n'a jamais été construit. Le rapport publié est le rapport déterministe canonique.

## Corrections vérifiées

- `ETL-MCO-PRO-02` : la banque et la bonne réponse canonique `optionId B` sont inchangées. La projection humaine affiche « Oui : la probabilité qu’elle soit porteuse est d’environ 59,5 % » et une explication bayésienne correcte. La formulation « Non : … 59 % » et les notes éditoriales internes sont absentes des trois audiences.
- Logarithme : les restitutions parlent uniquement de « repérage anticipé de Terminale » ; les tests de contrat interdisent les formulations de lacune/prérequis de Première ou de notion censée être maîtrisée l'année précédente.
- Confiance : pour `entree-terminale-maths-complementaires-v1`, une réponse cochée sans certitude est refusée avec `PAPER_ENTRY_CONFIDENCE_REQUIRED`. L'UI ne rend pas « Absente de la copie » et bloque la soumission tant que chaque réponse cochée n'a pas une certitude 1–4. Une vraie non-réponse `null/null` reste autorisée.
- Identifiants techniques : `ETL-MCO-*`, `MATHS_COMPLEMENTAIRES` et `logarithme-reperage` ne sont pas exposés dans les documents humains.
- Scoring : aucun fichier de banque, contenu/checksum ou moteur de scoring n'a changé. Les tests recalculent l'attendu depuis les `isCorrect` de la banque et le comparent au snapshot canonique. L'ordre interne `[B,A,C,D]` de `ETL-MCO-SUI-01` reste intact tandis que la copie affiche A/B/C/D et score par ID.

## Parcours navigateur réel

Sur un serveur Next local et un PostgreSQL 15 jetables isolés, avec uniquement un compte `ASSISTANTE` et un foyer synthétiques :

- connexion ASSISTANTE ;
- création du foyer et de l'élève Terminale via l'UI ;
- sélection « Terminale · Mathématiques complémentaires » ;
- 18 lignes, chacune avec A/B/C/D dans cet ordre ;
- aucune option de confiance absente ;
- bouton inactif après une réponse choisie sans confiance ;
- bouton actif après 18 certitudes valides ;
- POST de saisie HTTP 201 ;
- DB : provenance `SAISIE_PAPIER`, sujet `MATHEMATIQUES`, bon pack, 18 réponses et 18 confiances ;
- score et rapport créés par les workers canoniques ;
- `REPORT_PENDING_REVIEW` / `PENDING_REVIEW` visible ;
- trois HTML et trois PDF prévisualisés ;
- validation par ASSISTANTE ;
- DB : tentative et artifact `PUBLISHED`, révision `COACH_VALIDATED`, revue `APPROVED` par une ASSISTANTE ;
- égalité stricte `preview HTML === artifact publié HTML` pour ELEVE, PARENTS et NEXUS ;
- statut final « Diffusé » visible dans l'UI.

Le scheduler du serveur `next dev` isolé n'a pas dépilé le job dans la fenêtre d'attente du navigateur ; les deux jobs réellement créés dans l'outbox ont donc été exécutés explicitement avec les fonctions de workers canoniques. Aucun chemin de production alternatif ou second moteur n'a été créé.

## Scénarios PostgreSQL

- Scénario A : 18 réponses justes, tentative idempotente, score global 100, scores/domaines/calibration conformes à l'attendu indépendant, rapport déterministe revu et publié.
- Scénario B : erreurs volontaires en suites, dérivation, probabilités conditionnelles (`ETL-MCO-PRO-02` choisi A), logarithme, plus une non-réponse. Scores, profils, priorités, calibration, texte ETL et statut logarithme conformes.

## PDF / HTML

Six PDF ont été extraits et les 20 pages du scénario B ont été rasterisées. La planche complète et les pages ETL ont été inspectées visuellement : A4 lisible, accents corrects, pas de texte coupé ou superposé observé. Les six extractions contiennent « Mathématiques complémentaires » et « repérage anticipé » ; aucune ne contient la formulation ETL fausse, une note interne, un identifiant technique brut ou « lacune de Première ».

## Vérifications exécutées

- 9 suites Jest unitaires ciblées : **58 PASS / 0 FAIL**.
- Intégration PostgreSQL MCO réelle : **22 PASS / 0 FAIL**.
- `npm run typecheck` : **PASS**, sortie 0.
- ESLint ciblé sur runtime et tests du hotfix : **PASS**, sortie 0.
- `npm run lint` complet : **PASS**, sortie 0 ; 30 avertissements préexistants, tous dans le module `candidat-libre` hors périmètre.
- `npm run build` : **PASS**, sortie 0 ; 93 pages générées, traces valides, audit artifact valide, standalone valide, aucune donnée runtime incluse. Un premier essai avait échoué pendant `Collecting page data` à cause d'un `next dev` concurrent écrivant dans le même `.next` ; après arrêt contrôlé de ce serveur, le build frais complet a réussi.
- `git diff --check` : **PASS**.
- Diff banque JSON, contenu/checksum et scoring : **vide**.
- Playwright ciblé : création foyer/élève, saisie, blocage confiance, publication et statut final vérifiés.

## Estimation opérationnelle de saisie

Estimation prudente : **4 à 6 minutes par copie** pour une assistante entraînée, contrôle final inclus. Méthode : 36 choix obligatoires (18 réponses + 18 certitudes), environ 2,5 s par choix, 3–4 s de contrôle croisé par question, puis 60–120 s pour identité, matière et vérification finale. Prévoir 6–8 minutes pour les premières copies avant prise en main.

## Ressources temporaires et données

- Conteneur créé : `nexus-mco-finalverify-a63d9f25`, sans mount/bind, stockage PostgreSQL en `tmpfs`.
- Avant destruction finale, les tables tentative/rapport étaient revenues à zéro après le test d'intégration ; seuls les comptes/élèves synthétiques UI subsistaient dans cette base jetable.
- Le conteneur a été supprimé et son absence vérifiée : toutes les données synthétiques qu'il contenait sont détruites.
- Le serveur local 3219 a été arrêté.
- Les sources copiées, stockages locaux, scripts Playwright et artefacts HTML/PDF temporaires créés par cette vérification ont été supprimés et leur absence vérifiée.
- Le conteneur dédié `nexus-mco-disposable-77d4dbc7`, créé plus tôt pendant cette mission, a également été inspecté (`Mounts=[]`, PostgreSQL en `tmpfs`), puis supprimé ; son absence a été vérifiée.
- Les deux répertoires d'artefacts synthétiques connus, `/tmp/nexus-mco-final.ayFWa0` et `/tmp/nexus-mco-e2e.Wf3DTU`, ont été supprimés et leur absence vérifiée.
- `.tmp-mco-ui/`, modification locale préexistante du worktree, n'a pas été touché.

## Risques et actions avant une vraie copie

- L'activation du flag en production et l'état du worker de production restent des décisions opérateur hors de cette mission ; vérifier ces deux points au moment autorisé.
- Le hotfix reste local et non commité. Il doit être revu puis intégré selon le processus normal avant usage production.
- Conserver la narration LLM désactivée pour ce parcours urgent et la revue au rôle ASSISTANTE.

## Rollback

Retirer uniquement les modifications runtime/tests listées dans le diff de cette branche. Aucune migration, dépendance, donnée ou configuration production n'a été ajoutée.
