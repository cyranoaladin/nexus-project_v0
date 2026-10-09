# Remédiation CI — PR #337

## Point courant — 4 octobre — campagne 71a973349 terminée

Code local : `98ff57b24ea60abc60bc72759b90e2759c29dc61`, six commits après le distant `71a973349981bf691939ca0dcf1dc4a455624776`. Ce dernier présente 44 succès, sept échecs et un contrôle ignoré ; Chromium auth est désormais vert. La nouvelle CI n'a pas encore démarré. PR Draft, NOT_READY, aucun déploiement.

Les défauts restants de cette campagne sont CodeQL, Dependency Integrity/policy stale et son Security Scan en aval, transport ARIA desktop/mobile et fixture du smoke vidéo désactivée. Corrections causales locales : identités durables d'émission mail (`email-issuance-identity.md`), consommation native SSE et cleanup (`sse-native-consumer.md`), rattachement réel de la fixture (`video-disabled-family-fixture.md`). La gate E019 ×20 (`mobile-e019-repeat-gate.md`) attend sa première campagne réelle. Aucun échec n'est fermé par la seule présence du commit ; ARIA Requirement Evidence est ignoré en aval des échecs ; il doit s'exécuter et réussir sur le prochain SHA.

Les sections suivantes conservent les constats et preuves historiques avec leurs limites ; elles ne constituent pas la qualification du nouveau HEAD.

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

Les causes atelier et mobile ont été corrigées localement. CodeQL et la
qualification distante du nouveau HEAD restent ouverts.
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
Le rapport de couverture complet a été régénéré sur `949549d21` :
190 suites / 2 464 tests applicatifs, 32 suites / 352 PostgreSQL et
5 suites / 27 tests de concurrence réussis. Contrôle de couverture :
lignes 97,38 %, fonctions 97,32 %, branches 95,29 %, statements 96,38 %,
chemins critiques 100 %. Aucun seuil abaissé.

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

Sur `949549d21`, le script mobile canonique a réussi les quatre viewports.
Le scénario 390×844 a ensuite réussi 20 répétitions : aucun échec,
aucun retry, aucun skip, durée 284,17 secondes. La capture mobile ready
a été inspectée : aucun débordement ou élément superposé observé.
Le changement de mot de passe V1/Core réussit ses quatre scénarios à
390/1440 px. Le cycle d'authentification réussit 60 scénarios répartis
entre Chromium, Firefox, WebKit et profil Pixel 7. Une trace Playwright
réussie reste à inspecter ; les captures ne remplacent pas cette preuve.

## Qualification locale du jalon `949549d21`

| Contrôle réellement exécuté | Résultat |
|---|---|
| Suite unitaire | 1 274 suites, 14 286 tests, aucun ignoré |
| Core PostgreSQL avec ClamAV | 68 suites, 670 tests, aucun ignoré |
| Intégration générale, isolation conforme à la CI | 57 suites, 316 tests |
| Intégration ARIA disposable, lane distincte | 9 suites, 27 tests |
| Sessions / compte pending / onboarding parent / schéma bilan, bases dédiées | 3 / 10 / 12 / 9 tests |
| Typecheck | réussi |
| Lint complet | réussi, 27 avertissements préexistants |
| Build officiel complet et contrôles standalone | réussi en configuration vidéo DISABLED |
| Scan secrets de la branche | aucun finding |
| Audit dépendances production | aucun finding |

Les deux premiers essais de build ont été refusés par le garde-fou vidéo
(fallback public puis domaine de test). Aucun garde-fou modifié ; le troisième
utilise le mode DISABLED officiel pour qualifier l'artefact local. Cela ne
valide pas la configuration vidéo production. Le manifest suivi a été
restauré avec ses octets d'origine après conservation privée de la preuve.

L'audit dépendances complet relève 39 entrées high de développement,
issues des advisories `GHSA-vfj7-8cjw-p6xm` (braces) et
`GHSA-ch52-4w7c-c8xp` (http-cache-semantics). Aucun correctif publié n'a
été constaté lors de la vérification. Ni mise à jour majeure aveugle,
ni baisse du scanner : exposition de la chaîne de build à qualifier.

Le commit de contrats de jetons ajoute quatre tests PostgreSQL (32/32
avec les suites account/HTTP voisines) et le dossier de décision CodeQL.
Toute modification du HEAD nécessite une nouvelle qualification distante ;
les résultats de ce tableau restent des preuves du jalon indiqué, pas une
déclaration de CI verte sur un commit ultérieur.

## Fixture vidéo : passage de minuit

La requalification unitaire du 4 octobre a reproduit trois échecs dans
`session-calendar-video-availability.test.tsx`. À 00:06 Africa/Tunis,
`now - 10 minutes` donne la veille à 23:56 ; la fixture ne conserve que
HH:mm et lui affecte la date d'aujourd'hui, créant donc une séance future.
Le composant refuse correctement de proposer Join pour cette séance.

Reproduction isolée avant correction : trois échecs, un succès. Correction :
horloge Jest fixe à midi UTC pour les tests de dispatch vidéo, remise en
horloge réelle après chaque test. Après correction : quatre succès.
Toutes les assertions, les modes vidéo et la disponibilité métier restent
inchangés. La suite complète doit être renouvelée sur le nouveau commit.

## Qualification publiée `1e2d0a5c745479ef11e58edef575e390af6583d1`

Sept commits correctifs publiés normalement vers la branche de PR #337, Draft conservé. Tests locaux : 1 274 suites / 14 286 tests unitaires, 69 suites / 674 tests Core-v2, couverture ARIA 190/2 464 + PostgreSQL 32/352 + concurrence 5/27, seuils conservés et chemins critiques 100 %. Typecheck/lint et build canonique réussis. Mobile isolé 20/20, matrice mobile 4/4, account 4/4 et lifecycle auth multi-navigateurs 60/60. Une trace de succès supplémentaire a été inspectée (592 événements d’action, zéro erreur d’action, 115 frames) ; dernier état vide responsive inspecté visuellement. Les deux streams interrompus `/api/aria/chat` (annulation/timeout contrôlés) et le préchargement `/dashboard/trajectoire` existent encore comme prévu par les scénarios ; aucune interruption de navigation vers account/security. Cookies/tokens de la trace ne sont pas exportés vers le dossier de preuves hôte.

CI distante démarrée sur ce SHA. Le job ARIA PostgreSQL précédemment rouge est maintenant réussi ; CodeQL reste rouge, finding élevé #102 non classé. Les résultats distants complets ne sont pas encore acquis. La suite de migration réelle et le correctif CSRF ajoutés ensuite exigent de nouvelles preuves sur leur HEAD final. Ce jalon ne qualifie ni l’ensemble fonctionnel ni une release production.
