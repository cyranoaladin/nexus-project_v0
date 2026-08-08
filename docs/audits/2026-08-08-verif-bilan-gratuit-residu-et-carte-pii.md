# Vérification bout-en-bout « Bilan gratuit » parent — résidu synthétique et carte PII

## Date

7-8 août 2026, fuseau `Africa/Tunis`.

## Contexte et périmètre

Vérification read-write, sur production réelle (`https://nexusreussite.academy`),
du parcours complet « Bilan gratuit » côté parent : inscription/activation,
ajout d'enfant(s), passation du test (18 réponses réelles), scoring
automatique, validation + publication par une assistante, consultation
parent + téléchargement PDF. Comptes strictement synthétiques (parent : alias
jetable sur la boîte de l'opérateur ; élèves : domaine généré
`@nexus-student.local`). Aucun compte réel de famille touché.

Les 7 étapes fonctionnelles sont **OK**, preuve réelle à l'appui (HTTP,
base, PDF téléchargé octet-pour-octet identique à l'enregistrement en
base). Ce document couvre uniquement les deux points restés ouverts après
cette vérification : le résidu de nettoyage et la carte PII qui doit
guider la conception d'un futur mécanisme d'effacement.

## Partie 1 — Résidu synthétique après nettoyage

### Ce qui a été supprimé

6 lignes, 4 tables, confirmées à 0 par requête SQL directe : 2 lignes
`canonical_job_outbox`, 2 lignes `canonical_parent_student_links`,
l'utilisateur enfant non activé et sa fiche `students` (cascade).

### Ce qui reste, et pourquoi

| Table | Lignes | Bloqué par |
|---|---:|---|
| `users` (parent) | 1 | `parent_profiles.userId` référence encore la fiche parent |
| `users` (2ᵉ enfant, celui qui a passé le bilan) | 1 | `students.userId` → `students` bloqué par `canonical_assessment_attempts.studentId` (RESTRICT) |
| `parent_profiles` | 1 | `students.parentId` (CASCADE) toucherait les deux enfants, dont celui bloqué |
| `students` (2ᵉ enfant) | 1 | `canonical_assessment_attempts.studentId`, `canonical_report_artifacts.studentId` (RESTRICT) |
| `canonical_assessment_attempts` | 1 | chaîne rapport en aval, elle-même append-only |
| `canonical_report_revisions` | 1 | trigger `canonical_bilans_guard_report_revision_mutation` (append-only) |
| `canonical_report_artifacts` | 1 | RESTRICT depuis `canonical_report_revisions` (append-only) |
| `canonical_report_materializations` | 1 | trigger `canonical_bilans_guard_rendered_artifact_immutability` |
| `canonical_report_audience_artifacts` | 3 | idem |
| `canonical_report_reviews` | 1 | trigger `canonical_report_reviews_append_only` |
| `canonical_score_snapshots` | 1 | trigger `canonical_bilans_reject_append_only_mutation` |

Les triggers append-only ont été volontairement **laissés intacts** — aucun
contournement, aucune désactivation, conformément à la consigne. Le blocage
est un effet de bord correct d'une garantie d'intégrité d'audit, pas un bug.

### Étiquetage machine-lisible : impossible sans migration

Recherche exhaustive dans le code (modèles Prisma `User`, `ParentProfile`,
`Student`, requêtes d'agrégation admin) : **aucune colonne libre/metadata/tag
n'existe** sur ces tables mutables pour porter une étiquette du type
`SMOKE_TEST_RESIDUAL` sans migration de schéma. Aucune convention
équivalente n'est déjà consommée par une requête — `app/api/admin/dashboard/route.ts`
fait `prisma.user.count()` / `prisma.student.count()` /
`prisma.parentProfile.count()` sans filtre, et aucune route de dashboard
n'agrège aujourd'hui `canonical_assessment_attempts` ou `ReportArtifact`.

**Conséquence concrète** : les compteurs génériques (`user.count()`, etc.)
sont pollués de +1 à +4 selon la table — négligeable en valeur absolue sur
une base de production, mais réel en principe. La chaîne bilan elle-même
(la partie la plus sensible) n'est aujourd'hui agrégée nulle part, donc son
résidu ne fausse aucun tableau de bord existant.

**Identification durable actuelle** : la convention de nommage déjà en place
(préfixe de vérification sur les noms, domaine généré `@nexus-student.local`,
alias jetable côté parent) reste la seule marque distinctive, lisible par un
humain qui interroge la base, mais non filtrable automatiquement par une
requête sans connaître ce motif à l'avance. Les valeurs exactes ne sont
volontairement pas reproduites ici.

**Recommandation, non exécutée** : une colonne `internalNote`/`syntheticMarker`
sur `User` (mutable, hors chaîne append-only) résoudrait le problème pour
les futures vérifications, mais est une migration de schéma — hors périmètre
d'une tâche read-write de vérification ponctuelle, nécessite sa propre
revue/déploiement.

### Leçon de process — consignée

Toute vérification bout-en-bout touchant les tables append-only
(`canonical_score_snapshots`, `canonical_report_revisions`,
`canonical_report_materializations`, `canonical_report_audience_artifacts`,
`canonical_report_reviews`) doit désormais s'exécuter sur un **clone ou un
environnement de staging**, jamais directement en production — un nettoyage
complet y est structurellement impossible une fois une ligne insérée dans
ces tables.

## Partie 2 — Carte PII de la chaîne bilan (cadrage, aucune modification)

Objectif : poser la carte exacte permettant de concevoir un futur
mécanisme d'effacement RGPD qui n'affaiblit jamais l'append-only.

| Table | Append-only ? | Colonnes PII | Mode |
|---|---|---|---|
| `users` | Mutable | email, firstName, lastName, phone | Source de vérité |
| `parent_profiles` | Mutable | address, city (nom/email via FK `users`) | Référencé uniquement |
| `students` | Mutable | school, birthDate, survivalModeReason (texte libre) | Référencé uniquement |
| `canonical_assessment_attempts` | Mutable tant que `DRAFT`/`IN_PROGRESS`, puis verrouillé en pratique | `answers` = strictement `{itemId, optionId, confidence}`, validé `zod .strict()` | Référencé uniquement (`studentId`) |
| `canonical_score_snapshots` | **Append-only** (trigger inconditionnel) | `result` = `FactSheet`, `student.alias` pseudonymisé (`ELEVE_XXXX`, regex-imposé) | Aucune PII embarquée |
| `canonical_report_revisions` | **Append-only** (exception étroite : transition `PENDING_REVIEW→COACH_VALIDATED`, contenu inchangé) | `content.identity.displayName` = **le pseudonyme**, pas le nom réel | Aucune PII embarquée |
| `canonical_report_artifacts` | Verrouillé de fait (RESTRICT depuis `revisions`, elle-même append-only) | aucune | Référencé uniquement |
| `canonical_report_materializations` | **Append-only** (trigger inconditionnel) | aucune colonne PII directe | Référencé uniquement |
| `canonical_report_audience_artifacts` | **Append-only** (trigger inconditionnel) | `html`/`pdf` = documents rendus, portant le **pseudonyme** (`render/html.ts:71`) | Aucune PII embarquée |
| `canonical_report_reviews` | **Append-only** (trigger inconditionnel) | `motif` (texte libre, non validé, un·e réviseur·se peut y écrire un nom) | **Risque d'embarquement en dur, non garanti** |
| `candidate_diagnostics` + `candidate_diagnostic_documents` | Mutable (CASCADE simple, aucun trigger) | `metadata`/`synthesis` (JSON) ; `title`/`description`/`originalName` des documents (texte libre) | Metadata référencé ; `originalName`/`title` peuvent embarquer de la PII ; fichiers réels hors base (`storageKey`) |

### Correction — la frontière de pseudonymisation va jusqu'au bout

Une première version de ce document affirmait que le nom réel était
réinjecté en aval via `RenderIdentity.displayName` et gravé dans `content`
puis dans les octets `html`/`pdf`. **C'est faux.** Vérification faite
directement sur les octets stockés en production (les 3 artefacts
d'audience de la vérification, l'élève s'appelant réellement
« E2ESecondEnfant VerifBilanGratuit ») :

| Colonne vérifiée | Nom réel présent ? | Pseudonyme présent ? |
|---|---|---|
| `audience_artifacts.html` (ELEVE / PARENTS / NEXUS) | non | oui (`ELEVE_LYDEIFKVRKDB`) |
| `audience_artifacts.pdf` | non | — |
| `report_revisions.content` | non | oui |
| `score_snapshots.result` | non | oui |
| `assessment_attempts.answers` | non | — |
| `report_reviews.motif` | non (texte saisi sans PII) | — |

La cause : `RenderIdentity.displayName` est alimenté par
`factSheet.student.alias` aux deux sites de construction
(`worker/generate-report-job.ts:209`, `worker/scoring.ts:112`), et cet
alias est un dérivé SHA-256 de l'`attemptId` au format `ELEVE_XXXX`
(`worker/scoring.ts:93-96`), dont le format est imposé par `buildFactSheet`
(`facts/fact-sheet.ts:66-67`). La chaîne append-only ne contient donc
**aucune PII réelle** : elle est pseudonyme de bout en bout.

### Conséquence sur la conception de l'effacement

L'effacement RGPD ne nécessite **ni crypto-shredding ni chiffrement des
artefacts** : il suffit d'anonymiser les tables **mutables**
(`users`, `students`, `parent_profiles`), qui portent seules la clé de
ré-identification. Les lignes append-only deviennent alors des données
pseudonymes non ré-identifiables, ce qui est exactement le résultat visé
par une anonymisation par séparation. Aucun trigger n'est touché.

Les seuls points restants sont :

1. `canonical_report_reviews.motif` — texte libre non validé, où un membre
   du personnel *pourrait* écrire un nom. Seul trou réel restant ; se
   traite en contraignant l'écriture, pas en chiffrant.
2. La garantie de pseudonymité tenait par construction sans être
   **imposée** : `assertRenderIdentity` ne vérifiait que la non-vacuité des
   champs. Un changement futur écrivant le vrai nom aurait été
   irrattrapable (append-only). C'est désormais verrouillé par
   `assertPseudonymousRenderIdentity`, appliqué aux trois chemins qui
   alimentent l'immuable.
3. L'effacement lui-même n'existe toujours pas : la suppression d'un compte
   élève ayant un bilan échoue sur les FK `RESTRICT`, et aucun chemin
   d'anonymisation n'est implémenté. C'est le vrai manque fonctionnel, et
   il concerne dès aujourd'hui les vraies familles ayant un bilan publié.
