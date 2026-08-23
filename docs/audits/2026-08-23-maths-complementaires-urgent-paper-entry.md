# Audit du hotfix urgent — saisie papier Mathématiques complémentaires

## Date

23 août 2026 (Africa/Tunis).

## Verdict

`READY FOR URGENT PAPER ENTRY`

Ce verdict porte sur le runtime local vérifié pour le nouveau hotfix de certitude absente. Son déploiement n'a pas encore été effectué au moment de cette mise à jour.

## Base et état Git

- Worktree : `/home/alaeddine/Bureau/nexus-project_v0-maths-complementaires-runtime`.
- Branche : `feat/maths-complementaires-runtime-bilans`.
- Base du hotfix : `origin/main` au SHA `72bea0bd`.
- HEAD avant commit produit : `188ef436` (spécification et plan approuvés).
- Le runtime MCO antérieur a été mergé par la PR #170 et déployé au SHA `e7294102`; le flag MCO a ensuite été réactivé en production sans activer la narration LLM.
- Aucun push, merge ou déploiement du présent hotfix de certitude absente n'a encore été effectué.
- `.tmp-mco-ui/` était préexistant et a été préservé.

## Architecture réellement exercée

`Terminale → Mathématiques complémentaires → PaperEntryGrid → POST /api/bilans/saisie-papier → CanonicalAssessmentAttempt(SAISIE_PAPIER) → SCORE_ATTEMPT → FactSheet canonique → GENERATE_REPORT en DETERMINISTIC_FALLBACK → PENDING_REVIEW → prévisualisations ELEVE/PARENTS/NEXUS → validation ASSISTANTE → PUBLISHED`.

La narration familiale LLM a été explicitement absente de l'environnement de test. Le transport LLM espionné n'a jamais été construit. Le rapport publié est le rapport déterministe canonique.

## Corrections vérifiées

- `ETL-MCO-PRO-02` : la banque et la bonne réponse canonique `optionId B` sont inchangées. La projection humaine affiche « Oui : la probabilité qu’elle soit porteuse est d’environ 59,5 % » et une explication bayésienne correcte. La formulation « Non : … 59 % » et les notes éditoriales internes sont absentes des trois audiences.
- Logarithme : les restitutions parlent uniquement de « repérage anticipé de Terminale » ; les tests de contrat interdisent les formulations de lacune/prérequis de Première ou de notion censée être maîtrisée l'année précédente.
- Confiance : pour `entree-terminale-maths-complementaires-v1`, chaque question propose désormais 1/2/3/4 et « Absente de la copie ». Une réponse cochée avec ce dernier choix conserve son `optionId` et enregistre `confidence:null`. Une vraie non-réponse reste `optionId:null, confidence:null`; lui associer une certitude reste interdit. Une certitude non traitée bloque toujours la soumission.
- Limite acceptée pour l'urgence : le moteur canonique générique conserve sa sémantique actuelle pour `confidence:null` et la classe comme non sûre dans la calibration. Ce hotfix n'introduit aucun nouveau calcul et ne modifie ni score de connaissances, ni FactSheet, ni worker.
- Identifiants techniques : `ETL-MCO-*`, `MATHS_COMPLEMENTAIRES` et `logarithme-reperage` ne sont pas exposés dans les documents humains.
- Scoring : aucun fichier de banque, contenu/checksum ou moteur de scoring n'a changé. Les tests recalculent l'attendu depuis les `isCorrect` de la banque et le comparent au snapshot canonique. L'ordre interne `[B,A,C,D]` de `ETL-MCO-SUI-01` reste intact tandis que la copie affiche A/B/C/D et score par ID.

## Parcours navigateur réel

Le parcours navigateur complet antérieur a validé le câblage réel jusqu'à la publication. Le présent hotfix ajoute les preuves ciblées suivantes sur la page réelle et le composant de saisie :

- connexion ASSISTANTE ;
- création du foyer et de l'élève Terminale via l'UI ;
- sélection « Terminale · Mathématiques complémentaires » ;
- 18 lignes, chacune avec A/B/C/D dans cet ordre ;
- chaque ligne propose 1/2/3/4 et « Absente de la copie » ; la page MCO réelle rend exactement 18 radios « Absente de la copie » ;
- bouton inactif après une réponse choisie sans confiance traitée ;
- bouton actif lorsque chaque réponse cochée possède une certitude 1–4 ou « Absente de la copie » ;
- POST de saisie HTTP 201 ;
- DB : provenance `SAISIE_PAPIER`, sujet `MATHEMATIQUES`, bon pack, 18 réponses, avec conservation d'un `optionId` lorsque sa certitude est `null` ;
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
- Scénario B : erreurs volontaires en suites, dérivation, probabilités conditionnelles (`ETL-MCO-PRO-02` choisi A), logarithme, plus une non-réponse et une réponse correcte `ETL-MCO-TAU-02` dont la certitude est absente. L'`optionId` est conservé, `confidence:null` est persisté et le score de connaissances attendu reste inchangé. Scores, profils, priorités, calibration canonique actuelle, texte ETL et statut logarithme sont conformes.

## PDF / HTML

Six PDF ont été extraits et les 20 pages du scénario B ont été rasterisées. La planche complète et les pages ETL ont été inspectées visuellement : A4 lisible, accents corrects, pas de texte coupé ou superposé observé. Les six extractions contiennent « Mathématiques complémentaires » et « repérage anticipé » ; aucune ne contient la formulation ETL fausse, une note interne, un identifiant technique brut ou « lacune de Première ».

## Vérifications exécutées

- TDD RED du hotfix : **34 PASS / 2 FAIL**, les deux causes attendues uniquement (absence de la radio sur la page MCO et rejet serveur `PAPER_ENTRY_CONFIDENCE_REQUIRED`).
- TDD GREEN ciblé : **5 suites / 44 PASS / 0 FAIL**.
- Intégration PostgreSQL MCO réelle après hotfix : **1 suite / 21 PASS / 0 FAIL**.
- Préflight Playwright Chromium : **PASS**.
- `npm run typecheck` : **PASS**, sortie 0.
- `npm run lint` : **PASS**, sortie 0 ; 30 avertissements préexistants dans `candidat-libre`, hors périmètre.
- `npm run build` : **PASS**, sortie 0 ; 93 pages générées, traces et artefact standalone validés, aucune donnée runtime incluse.
- `git diff --check` : **PASS**.
- Diff banque JSON, contenu/checksum et scoring : **vide**.
- Revue de conformité indépendante : **APPROVED**.
- Revue qualité indépendante : **APPROVED**, avec un commentaire de test obsolète corrigé.

## Estimation opérationnelle de saisie

Estimation prudente : **4 à 6 minutes par copie** pour une assistante entraînée, contrôle final inclus. Méthode : 36 choix obligatoires (18 réponses + 18 certitudes), environ 2,5 s par choix, 3–4 s de contrôle croisé par question, puis 60–120 s pour identité, matière et vérification finale. Prévoir 6–8 minutes pour les premières copies avant prise en main.

## Ressources temporaires et données

- Conteneur du nouveau hotfix : `nexus-mco-postgres-20260823T214544Z-3904621`, sans volume partagé, stockage PostgreSQL en `tmpfs`.
- Sa suppression et son absence ont été vérifiées après les **21 tests PASS** ; toutes ses données synthétiques sont détruites.
- Conteneur de la vérification antérieure : `nexus-mco-finalverify-a63d9f25`, sans mount/bind, stockage PostgreSQL en `tmpfs`.
- Avant destruction finale, les tables tentative/rapport étaient revenues à zéro après le test d'intégration ; seuls les comptes/élèves synthétiques UI subsistaient dans cette base jetable.
- Le conteneur a été supprimé et son absence vérifiée : toutes les données synthétiques qu'il contenait sont détruites.
- Le serveur local 3219 a été arrêté.
- Les sources copiées, stockages locaux, scripts Playwright et artefacts HTML/PDF temporaires créés par cette vérification ont été supprimés et leur absence vérifiée.
- Le conteneur dédié `nexus-mco-disposable-77d4dbc7`, créé plus tôt pendant cette mission, a également été inspecté (`Mounts=[]`, PostgreSQL en `tmpfs`), puis supprimé ; son absence a été vérifiée.
- Les deux répertoires d'artefacts synthétiques connus, `/tmp/nexus-mco-final.ayFWa0` et `/tmp/nexus-mco-e2e.Wf3DTU`, ont été supprimés et leur absence vérifiée.
- `.tmp-mco-ui/`, modification locale préexistante du worktree, n'a pas été touché.

## Risques et actions avant une vraie copie

- Le flag MCO est actuellement activé en production ; la narration LLM doit rester désactivée et le worker actif lors du déploiement.
- Le hotfix reste local à ce stade. Il doit passer la PR, la CI et l'approbation GitHub avant usage production.
- Après déploiement, effectuer un smoke authentifié sans soumission : Terminale → Mathématiques complémentaires → 18 questions → présence de 1/2/3/4 + « Absente de la copie » et blocage d'une certitude non traitée.
- Conserver la narration LLM désactivée pour ce parcours urgent et la revue au rôle ASSISTANTE.

## Rollback

Retirer uniquement les modifications runtime/tests listées dans le diff de cette branche. Aucune migration, dépendance, donnée ou configuration production n'a été ajoutée.
