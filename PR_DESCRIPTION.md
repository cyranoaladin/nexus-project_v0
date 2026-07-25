# Pré-rentrée 2026 — release informative sous gates

## Statut

**RELEASE BLOQUÉE AVANT GO — `Dependency Integrity` rouge.**

La campagne est maintenue à `releaseStatus=READY_FOR_OWNER_GO` et la PR reste
en draft. Le passage à `PUBLIC_READY`, le commentaire de GO, le tag, la sortie
du draft et le merge sont interdits tant que l'audit npm complet n'est pas
vert.

## Corrections de cette branche

- Les sept commits pédagogiques locaux sont préservés, avec les quatorze
  modules en statut `VALIDATED` et les dettes Maths/SVT clôturées sans
  suppression de leur historique.
- `next-auth` est porté à `5.0.0-beta.32`,
  `@auth/prisma-adapter` à `2.11.3` et l'unique
  `@auth/core` installé à `0.41.3`.
- Le script d'inventaire dérive désormais explicitement la PR et la branche ;
  aucune retombée silencieuse vers la PR #74 ou #75 n'est possible.
- L'inventaire actif identifie la PR #75 et la branche
  `feat/pre-rentree-planning-scheduler`. Le rattachement final au SHA doit être
  assuré par le tag annoté et le commentaire GitHub après tous les checks
  verts, sans boucle de commit auto-référente.
- Le périmètre est limité à `PUBLIC_INFORMATIONAL_RELEASE` : information,
  grille, tarifs, sélecteur local, téléphone, WhatsApp et neuf PDF
  `PUBLIC_FINAL`.
- Paiement, réservation, reçu, formulaire campagne, positionnement garanti,
  bilan parents, Parcours 360, manuel, remise annuelle et données nominatives
  d'enseignants sont exclus.
- L'allowlist publique contient exactement neuf PDF. Tous passent les contrôles
  de taille, checksum, type MIME `application/pdf` et signature `%PDF-`.
- Le grep brut des contenus destinés à être publiés ne trouve aucun
  `DRAFT`, `PROPOSAL`, `PROPOSITION`, `DOCUMENT DE TRAVAIL` ou `à valider`.

## Gates de campagne

- `VALIDATED` : `pedagogical_validation`, `capacity`, `tariffs`, `downloads`,
  `contact_channels_forms`.
- `MITIGATED_BY_SCOPE` : `teacher_assignments`, `rooms`, `qualifications`.
- `NOT_APPLICABLE` : `payment_receipt`, `cancellation_refund`,
  `privacy_retention`, `manuals_annual_discount`.
- `OPEN` : `publication_authorization`, volontairement laissée ouverte jusqu'au
  commit final de GO.

Les anciennes sorties documentaires internes conservent honnêtement
`LEGAL_REVIEW=PENDING`, `PRIVACY_REVIEW=PENDING` et
`PRIVATE_CONTRACTUAL_PACKAGE=BLOCKED`. Elles ne constituent ni l'allowlist
publique ni une validation juridique.

## Vérifications locales sous la version CI

Environnement : Node `22.23.1`, npm `10.9.8`.

- `npm ci` : succès.
- Arbre npm officiel : succès avec les seules exceptions optionnelles npm déjà
  documentées.
- `npm audit --omit=dev --audit-level=high` : succès, 0 vulnérabilité.
- `npm audit --audit-level=high` : **échec, 36 impacts high, 0 critical**.
- `npm run pre-rentree:ci` : succès ; 45 suites / 307 tests TypeScript et
  100 tests Python.
- Reproductibilité documentaire : 33 fichiers, 0 divergence.
- Tests unitaires complets : 580 suites réussies, 1 ignorée ; 7 076 tests
  réussis, 4 ignorés.
- Tests d'intégration : 11 suites, 125 tests réussis.
- `npm run lint` : succès, avertissements historiques sous le seuil configuré.
- `npm run typecheck` : succès.
- `npm run build` : succès ; 144 pages, 534 fichiers statiques concordants,
  artefact standalone valide.

## Blocage de sécurité restant

L'avis npm courant vise `brace-expansion <=5.0.7`. Les versions corrigées
officielles sont disponibles sur la ligne 5.x (`5.0.8`), mais pas sur les
lignes compatibles 1.x (`1.1.16`) et 2.x (`2.1.2`) encore requises
transitivement par les toolchains officielles ESLint/Jest/CycloneDX. Un
override global vers 5.x casse l'API attendue par les anciennes lignes ; les
changements majeurs proposés par `npm audit fix --force` sont incompatibles et
ne résolvent pas proprement l'arbre.

Aucune exception, baisse du seuil d'audit, substitution non officielle ou
contournement de check n'est ajouté.

## Conditions de reprise

1. Disposer de versions parentes officielles compatibles qui éliminent toutes
   les instances vulnérables.
2. Réinstaller avec le lockfile et obtenir zéro vulnérabilité high/critical sur
   l'audit de production et l'audit complet.
3. Relancer la chaîne locale et les workflows GitHub.
4. Seulement alors : commit `PUBLIC_READY`, tag/commentaire de GO, sortie du
   draft, merge et déploiement du SHA fusionné.
