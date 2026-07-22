# Processus de release documentaire

## Build local

Après `npm ci` et `python -m pip install -r scripts/pre-rentree/requirements.lock`, exécuter `npm run pre-rentree:ci`. Le compilateur lit les sources structurées, valide leurs conflits puis construit le snapshot. Le renderer Python ne reçoit que ce snapshot.

Les sorties sont préparées dans un répertoire temporaire, puis remplacent atomiquement `.artifacts/pre-rentree-2026/build`. Un échec conserve le dernier paquet complet et supprime le staging.

## Contenu de l’artefact REVIEW

- Guide Parents et dix annexes en PDF/HTML ;
- trois visuels sociaux de revue et leurs textes alternatifs ;
- 14 tests de positionnement, 70 évaluations rapides et 70 livrables matérialisés ;
- kit WhatsApp (24 scripts) et kit Facebook/Instagram/Reels ;
- CRM vierge, onze gabarits anonymes et modèle économique XLSX à hypothèses non inventées ;
- audits PDF, HTML, accessibilité, visuel, sécurité et reproductibilité ;
- matrices de sources, capacités, preuves et affectation.

Aucun de ces éléments de revue n’autorise une diffusion familiale.

## Dates et reproductibilité

- `sourceRepoSha` : ancre de provenance non auto-référentielle ;
- `sourceCommitDate` : date de cette ancre ;
- `snapshotBuiltAt` : date versionnée de compilation éditoriale ;
- `documentEditionDate` : date visible dans les documents ;
- `documentsBuiltAt` et `automatedVisualAuditAt` : heures externes au contenu déterministe ;
- `assistantVisualReviewAt`, `ownerReviewedAt`, `legalReviewedAt`, `privacyReviewedAt` : nuls tant qu’aucune action correspondante n’a eu lieu.

La CI fixe `SOURCE_DATE_EPOCH`. Deux builds ayant le même snapshot, les mêmes sources et dépendances produisent les mêmes documents publics. Les heures réelles restent dans des rapports externes ; elles ne modifient pas le PDF.

## Paquets

- `NexusReussite_PreRentree2026_PARENT_PACKAGE.zip` : documents familiaux candidats et assets hors ligne ;
- `NexusReussite_PreRentree2026_REVIEW_PACKAGE.zip` : paquet précédent plus artefacts pédagogiques, opérationnels, communication et audits.

Aucun paquet privé n’est produit. La CI téléverse les ZIP pendant 14 jours, sans release GitHub ni déploiement.

## Revue et invalidation

Le manifest lie la revue aux SHA-256. Toute modification rend une décision antérieure obsolète. Seuls le schéma, un template vide et le vérificateur d’approbation sont versionnés ; Codex ne crée ni identité ni décision humaine.

Passer de REVIEW à RELEASE exige les revues propriétaire, juridique et confidentialité, la validation des affectations, et les gates opérationnels des promesses retenues. La publication documentaire et le déploiement du site restent deux actions séparées et manuelles.
