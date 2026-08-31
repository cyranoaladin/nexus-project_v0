# Retrait de l’attestation `brace-expansion`

## Date

2026-08-31

## Contexte

L’attestation temporaire liée à `GHSA-mh99-v99m-4gvg` était liée au digest de
lockfile `3659d1ebe6cd8e70732bd2b8e0b39ff0d18748b54667448991c64c26a2d5f300`.
Le lockfile courant a le digest
`8cb6b4dd66061764c24b3b8ba579f5ed39d270541a239da22c746140d96a0dc1`.

## Problèmes observés

- Le lockfile et le graphe runtime avaient changé, ce qui activait deux
  conditions de révocation explicites de l’attestation.
- Les métadonnées OSV corrigées ne classent plus `brace-expansion@1.1.18`,
  `2.1.4` et `5.0.9` comme vulnérables.
- L’attestation exigeait encore deux findings OSV désormais inexistants et
  aurait donc rejeté le rapport scanner correct.
- `brace-expansion` reste absent du graphe runtime de production.

## Décisions prises

- Retirer l’attestation révoquée et son validateur spécialisé.
- Supprimer tout chemin d’exception associé dans la CI.
- Faire échouer directement `npm audit` complet et OSV sur tout finding ou
  toute erreur scanner.
- Conserver les rapports bruts et le SBOM comme preuves de CI.

## Fichiers modifiés

- `.github/workflows/ci.yml`
- `__tests__/ci/pr79-ci-evidence.test.js`
- suppression de l’attestation, du validateur et de leurs tests devenus sans
  objet.

## Tests exécutés

- `npm audit --omit=dev --audit-level=high --json`
- `npm audit --audit-level=high --json`
- tests unitaires des contrats CI et de l’audit d’artefact de production
- `npm run test:zero-debt`
- `npm run test:governance`

## Résultats

Les deux audits npm retournent zéro vulnérabilité et un code de sortie nul. Le
contrat CI prouve qu’aucune attestation active ne peut neutraliser un résultat
`npm audit` ou OSV non nul.

## Risques restants

Une future correction de métadonnées ou une nouvelle vulnérabilité fera
échouer la CI. Elle devra être corrigée ou faire l’objet d’une décision de
sécurité nouvelle et explicite ; aucune exception historique n’est réutilisée.

## Rollback

Ne pas restaurer l’attestation révoquée. En cas de régression du scanner,
conserver le fail-closed, diagnostiquer le finding exact et corriger les
dépendances ou créer une politique distincte, bornée et approuvée.
