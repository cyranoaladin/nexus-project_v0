# Gel de #337 — stabilisation des trois causes CI

Date : 2026-10-05. Distant de départ : 16ae686d5b54cc70fbc57ffc16f883e9650036c1 (207 commits / 644 fichiers, 46 succès / 6 échecs). Local accepté : 972083daa9a910a3bf4075a35537e026b6d19299, deux commits non publiés et huit fichiers de logs. Aucun merge dans la plage main…HEAD. Le périmètre est désormais limité aux trois racines CI et au lot de logs déjà commencé ; aucune nouvelle capacité ni migration.

## Cause A : frontière Core-v2

Import runtime du health endpoint déplacé vers lib/deployment/release-identity.ts, avec réexport de compatibilité Core-v2 ; aucun changement de garde/allowlist. Garde + health + stockage : 66 tests verts en lane unitaire ; helper release en lane Core-v2 : 6 verts. Build E2E sur 9c1364c4c : exit 0 en 284,5 s. Ce build est un artefact de qualification synthétique, pas une release production. Son manifeste généré est conservé dans le répertoire local ignoré ; seule l'écriture du build dans le manifeste source, auparavant propre, a été annulée depuis HEAD.

## Cause C : dialogue administrateur

Le premier bouton générique peut appartenir à PARENT/ELEVE : openEditDialog refuse volontairement leur édition générique. Le tri createdAt descendant rend le résultat dépendant des créations de comptes précédentes. Le bouton possède déjà un nom accessible Modifier {prénom} {nom} : aucune modification produit requise.

Reproduction locale : état seed seul = succès ; création d'une famille synthétique via POST /api/assistante/families = 201 ; ancien sélecteur vise l'enfant familial ; même test = échec, 1 inattendu / 0 ignoré. Trace locale inspectée : clic table button,… >> nth=0. Sur les mêmes données, le test corrigé passe : filtre ASSISTANTE et réponse 200, ligne unique Ines Assistante, bouton exact, dialogue Modifier Utilisateur, valeurs attendues et absence de mot de passe, charte/focus trap, fermeture Échap et Annuler avec retour focus. Aucun waitForTimeout dans ce scénario. Les attentes arbitraires des autres scénarios restent hors de ce lot.

Une étape obligatoire Chromium répète ce scénario 20 fois sans retries et refuse tout échec, skip ou flaky. Elle publie uniquement le rapport expurgé associé au SHA exact. Résultat local sur le test corrigé avant commit : 20/20 en 78,99 s, zéro inattendu, zéro skip, zéro flaky, sans retries. Empreinte SHA256 du scénario source : 22959d8af12ec2f2d60056fa6b332a8e646850c44e5d0b9055c124bd65a275b8. Le build applicatif est 9c1364c4c ; le correctif ne modifie que le test et sa preuve CI. La campagne distante finale reste à renouveler sur le candidat publié.

## Cause B : installation et policy

npm ci --no-audit --no-fund : succès, 1282 packages, Node 22.23.1 / npm 10.9.8. npm ls complet et production : exit 0 avec deux findings extraneous ; validateur canonique : exit 0 sous les exceptions EXISTANTES, aucune exception ajoutée. Chemin exact : sharp 0.35.4 → optional @img/sharp-webcontainers-wasm32 0.35.4 (cpu wasm32, absent sur Linux x64) → @img/sharp-wasm32 0.35.4 → @emnapi/runtime 1.11.3. npm matérialise les enfants sans leur parent ; ces nœuds sont référencés dans le lock, pas des nœuds orphelins à supprimer à la main.

Régénération npm package-lock-only/ignore-scripts : aucun nœud changé et SHA256 inchangé 6d436e41ac5c7f202e1d9923fc260a763a08d43cceb940a550a537e0bffa7bca. Audit production : zéro vulnérabilité toutes sévérités. Audit complet : cinq HIGH (@next/eslint-plugin-next 15.5.25, eslint-config-next 15.5.25, fast-glob 3.3.1, micromatch 4.0.8, braces 3.0.3), un advisory causal GHSA-vfj7-8cjw-p6xm. Derniers packages compatibles Next ESLint 15.5.26/15.5.27 : fast-glob inchangé. npm audit fix dry-run conserve les cinq HIGH ; downgrade majeur proposé non appliqué. L'advisory officiel ne publie aucun correctif : https://github.com/advisories/GHSA-vfj7-8cjw-p6xm.

La policy actuelle vise un ancien lock et 39 packages impactés, donc elle n'est pas applicable. Pas de remplacement d'empreinte ni d'approbation inventée. Une décision sécurité étroite, avec propriétaire, échéance et ticket #335, reste nécessaire si aucune correction compatible ne devient disponible. Security Scan dépend de cette preuve amont.

## Limites de qualification

La première tentative locale Core complète était mal configurée (Africa/Tunis à la place de Europe/Paris, destination V1 au mauvais nom, ClamAV absent) : 785 verts / 14 rouges, non qualifiée. Le harnais remis aux contrats CI (bases distinctes au nom canonique, Europe/Paris et vrai ClamAV) passe : 81 suites / 799 tests, zéro échec et zéro ignoré, code applicatif 9c1364c4c. Les refus du seeder et des préflights n'ont pas été contournés. Les campagnes E2E utilisent une stack fraîche, SMTP local et données synthétiques uniquement.

Aucun push tant que le lot cohérent et le gate dépendances ne sont pas fermés. PR Draft, statut NOT_READY. Aucun déploiement, fusion, revue invalidée réutilisée ou écriture dans les anciens worktrees. Les 31 capacités restantes sont reportées hors de #337.
