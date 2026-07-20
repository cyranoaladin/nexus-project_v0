# Processus de release documentaire

## Build local

Installer les dépendances Node avec `npm ci`, puis Python avec `python -m pip install -r scripts/pre-rentree/requirements.lock`. Depuis la racine Git, exécuter `npm run pre-rentree:ci`. Les programmes documentaires résolvent leurs entrées depuis la racine du dépôt et non depuis un répertoire courant implicite.

Les sorties sont atomiquement publiées sous `.artifacts/pre-rentree-2026/`. Un échec conserve le dernier paquet complet et supprime le staging partiel.

## Dates et reproductibilité

- `sourceCommitDate` date le SHA source canonique ;
- `snapshotBuiltAt` date l’édition versionnée du snapshot ;
- `documentEditionDate` alimente la surface publique (« Édition juillet 2026 ») ;
- `documentsBuiltAt` et les dates d’audit appartiennent aux rapports externes ;
- `ownerReviewedAt`, `legalReviewedAt` et `privacyReviewedAt` restent nuls avant action humaine.

Le renderer convertit `documentEditionDate` à minuit UTC avant le rendu PDF ; le résultat ne dépend donc pas du fuseau de la machine. La CI fixe également `SOURCE_DATE_EPOCH` et un test exécute cette conversion sous UTC et `Africa/Tunis`.

Deux builds du même commit sont comparés par SHA-256. Le paquet parents utilise la date d’édition, un ordre stable et doit rester identique entre les environnements verrouillés. Le paquet de revue contient les heures réelles de build et d’audit : son empreinte est propre à chaque exécution et reste consignée dans le résumé du workflow, sans modifier les documents familiaux.

## Paquets

- `NexusReussite_PreRentree2026_PARENT_PACKAGE.zip` : documents familiaux et assets nécessaires ;
- `NexusReussite_PreRentree2026_REVIEW_PACKAGE.zip` : paquet parents, audits, preuves visuelles et cartes de sources.

Aucun paquet privé n’est produit.

## Revue et invalidation

Le manifest de revue enregistre l’empreinte de chaque artefact. Le modèle d’approbation reste `PENDING` et sans identité. Toute modification change le manifest et rend une approbation antérieure obsolète. La validation propriétaire ne vaut ni validation juridique ni autorisation de diffusion.

La publication documentaire future et le déploiement du site sont deux opérations distinctes. Ce workflow n’effectue aucune des deux.
