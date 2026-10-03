# Remédiation CI — PR #337

## Référence de départ

`d65806143971d00e4ad2062e558ac718878b64cd` : 51 contrôles terminés,
44 réussis, 6 échoués, 1 ignoré. `CI Success` est une synthèse, pas un
défaut indépendant. Aucun résultat ancien ne qualifie un nouveau HEAD.

## Validation anti-injection / mot de passe surdimensionné

Workflow CI, job `Integration Tests`, exécution `37155686169`, job
`111298477790`. Première cause : `security/injection.test.ts:139`,
attente `true`, résultat `false`. Commande locale canonique :
`npm run test:integration -- --runTestsByPath __tests__/security/injection.test.ts`.
Node 22.22.0 ; configuration Jest d'intégration du dépôt ; environnement
de test isolé, fournisseur synthétique.

Payload : `A1` suivi de 100 000 lettres ASCII (100 002 octets). Le chemin
est une validation Zod pure, sans requête SQL, shell, HTML ou écriture en base.
Le titre demandait déjà un refus, mais l'assertion et les commentaires
historiques supposaient l'absence de plafond. Le contrat actuel impose
72 octets UTF-8 pour éviter la troncature silencieuse bcrypt.

Reproduction avant correction : 38 tests réussis, un échec attendu.
Correction : conserver la validation serveur ; exiger le refus et le
message de plafond. Après correction : 39/39 réussis. Les frontières
ASCII/UTF-8 restent couvertes par `new-password-bcrypt-boundary.test.ts`.
Il s'agit d'un défaut de test historique ; aucune protection abaissée.

## État global

CodeQL, atelier/rappels, mobile et preuves exact-HEAD restent ouverts.
PR en brouillon ; aucune fusion ou opération de production autorisée par
la seule réussite d'un lot. Statut : `NOT_READY`.
