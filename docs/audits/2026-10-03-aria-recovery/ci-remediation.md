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

## Atelier PostgreSQL et couverture

Jobs `ARIA PostgreSQL (db)` et `ARIA Coverage`, même première cause :
`aria-workshop-reminder.real.test.ts` inscrit un élève après création d'un
atelier déjà `CANCELLED`. La migration additive d'admission refuse cette
insertion avec SQLSTATE 23514 / `ARIA_WORKSHOP_NOT_SCHEDULED`.
La préparation échoue avant le scanner ; ce n'est ni un fuseau ni un retry.

Reproduction canonique : `npm run test:aria:db -- --runTestsByPath
__tests__/db/aria-workshop-reminder.real.test.ts` : 16 réussites, un échec.
La fixture corrigée passe par les services publics de planification et
d'inscription, avec horloge fixe, avant de fixer l'état terminal d'annulation.
Ce module V1 ne possède pas de service public d'annulation : cette lacune
fonctionnelle demeure distincte de la qualification du scanner.
L'inscription après annulation est aussi explicitement refusée (404).
Aucune suppression du trigger ou modification de l'horloge métier.

Premier essai corrigé : mauvaise attente d'un email d'inscription ; la
fixture minimale sans noms n'en produit pas. L'attente initiale de zéro
email est conservée, ainsi que le refus de création d'un rappel.
Qualification ciblée finale : 17/17 ; suite canonique complète
`npm run test:aria:db` : 32 suites, 352/352 tests réussis, aucun ignoré.
PostgreSQL 15 éphémère, image verrouillée par le script officiel.
Le rapport de couverture complet doit encore être régénéré.

## Contrôle ignoré

`ARIA Requirement Evidence` dépend de `aria-jest`, `aria-postgres` et
`aria-browser`. Sans condition explicite, GitHub applique `success()`.
Son saut découle des échecs amont. Ce contrôle est une gate requise : il
doit s'exécuter et réussir sur le nouveau SHA ; aucun skip permanent ou
changement de workflow n'est justifié.

## Mobile : chargement spéculatif de la sécurité du compte

L'artefact de trace CI `11286407056` a été analysé en mémoire, sans
persister ses cookies ou tokens. Les trois GET concernés portent
`RSC=1`, `next-router-prefetch=1`, renvoient initialement 200, puis leur
corps est annulé (`net::ERR_ABORTED`, taille -1). Ce sont les préchargements
Next.js du nouveau lien Navbar, pas un POST de changement de mot de passe.

Choix : la page de sécurité doit se charger sur navigation explicite ; son
lien utilise `prefetch={false}`. Aucun événement `requestfailed` ignoré,
aucune allowlist élargie, aucun timeout ou projet mobile désactivé.
Le lien conserve sa destination et reste accessible aux cinq rôles.
Tests de rendu avant correction : cinq échecs sur le préchargement actif.
Après : 20 tests réussis (cinq rôles et contrat du harness ARIA existant).

La qualification navigateur réelle, les vingt répétitions, l'inspection
visuelle et les projets auth multi-navigateurs restent à exécuter sur le
HEAD consolidé. Les preuves du SHA initial ne qualifient pas ce changement.
