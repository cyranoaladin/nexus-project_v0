# Plan d'implémentation du moteur canonique de bilans

## Base

- branche :
  `feat/bilan-assessment-engine-v1-20260730` ;
- SHA de départ :
  `be627c788b0b60a6ab63fe7d8f903863fe837278` ;
- dépendance : draft PR #88.

## Étape 1 — Contrats et sécurité du catalogue

Tests rouges :

- projection élève sans corrigé ni métadonnée de correction ;
- fixture publiée injectée uniquement par l'appelant de test ;
- transition de validation liée au hash ;
- changement de hash invalidant les décisions ;
- Physique-Chimie Seconde absente ;
- paquet de revue des 17 modules sans identité fabriquée.

Implémentation :

- projection publique dans `lib/pre-rentree/pedagogy/` ;
- contrats de revue humaine ;
- générateur déterministe des paquets sous `.artifacts/` ;
- script package et tests Python/TypeScript.

Commit ciblé :

`feat(pedagogy): add hash-bound human review contracts`

## Étape 2 — Schéma et migration

Tests rouges DB :

- inventaire des modèles et contraintes ;
- migration fresh et upgrade ;
- unicité affectation/idempotence, tentative/ordinal et tentative/item ;
- immutabilité après scellement ;
- claim concurrent ;
- décisions et audit append-only ;
- une publication active par audience/artifact ;
- historique conservé après révocation.

Implémentation :

- modification de `prisma/schema.prisma` ;
- nouvelle migration
  `20260730_add_canonical_assessment_engine_v1` ;
- format, validate et generate ;
- migration deploy sur bases locales jetables seulement.

Commit ciblé :

`feat(bilans): add canonical assessment engine persistence`

## Étape 3 — Domaine affectation/tentative/réponse

Tests rouges :

- affectation autorisée avec fixture et refus de tout corpus réel actuel ;
- définition/version/hash inconnus ;
- démarrage, reprise et double démarrage ;
- dépassement du nombre de tentatives ;
- réponse QCM/texte validée ;
- item étranger et type incorrect refusés ;
- autosaves concurrents et version obsolète ;
- soumission/autosave concurrents ;
- double soumission et rejeu incohérent ;
- modification après scellement ;
- événements et outbox atomiques.

Implémentation :

- erreurs et schémas ;
- principal et politiques d'accès ;
- service d'idempotence ;
- services d'affectation, tentative, réponse et soumission ;
- journal d'audit sans PII.

Commits ciblés :

- `feat(bilans): add canonical assessment assignments`
- `feat(bilans): implement resumable sealed attempts`

## Étape 4 — Correction manuelle et scoring

Tests rouges :

- correction automatique ;
- réponse courte en attente ;
- claim concurrent et lease expiré ;
- décision modifiée sans effacer l'ancienne ;
- finalisation incomplète refusée ;
- résultat provisoire refusé par défaut et autorisé par flag ;
- score final déterministe et recalcul identique ;
- policy/hash différent donnant une provenance distincte ;
- calibrage réel conservé en attente.

Implémentation :

- file de correction ;
- décisions versionnées ;
- politique brute `canonical-raw-item-score-v1` ;
- snapshots et evidence append-only ;
- contrat de calibrage sans seuil réel.

Commits ciblés :

- `feat(bilans): add manual review queue`
- `feat(bilans): implement versioned deterministic scoring`

## Étape 5 — Bilan, revue, publication et révocation

Tests rouges :

- génération déterministe par audience ;
- aucun corrigé dans parent/élève ;
- absence de score final refusée ;
- approbation par coach affecté/admin ;
- publication idempotente ;
- séparation des audiences ;
- accès avant publication refusé ;
- révocation conservant l'historique ;
- double publication concurrente ;
- audit et notification outbox atomiques.

Implémentation :

- template v1 ;
- services artifact/révision/revue/publication ;
- historique `ReportPublication` ;
- projections publiques strictes.

Commit ciblé :

`feat(bilans): add audience-scoped report publication`

## Étape 6 — Routes HTTP

Tests rouges par route :

- auth absente ;
- rôle insuffisant ;
- IDOR parent A/parent B ;
- mauvais item/affectation ;
- taille et validation ;
- rate limiting distribué indisponible ;
- idempotence et conflits ;
- réponses sans corrigé.

Implémentation :

- routes famille sous `app/api/bilan-gratuit/v1/requests/current/` ;
- routes équipe sous `app/api/bilan-gratuit/v1/team/` ;
- helpers communs de réponse, auth et rate limiting ;
- aucun parsing de source dans les routes.

Commit ciblé :

`feat(bilans): expose secured assessment engine api`

## Étape 7 — Interfaces minimales

Tests composants :

- progression, état autosave et reprise ;
- confirmation de soumission ;
- verrouillage après soumission ;
- attente de correction ;
- bilan seulement publié ;
- file équipe, claim, correction, revue et publication ;
- clavier, labels et absence de corrigé dans le HTML.

Implémentation :

- espace famille bilan ;
- espace équipe bilan ;
- composants partagés seulement lorsque la réutilisation est réelle ;
- aucun nouveau chemin public vers le corpus.

Commit ciblé :

`feat(bilans): add parent and staff assessment workflows`

## Étape 8 — Documentation et observabilité

Produire :

- ADR moteur ;
- ADR scoring/provenance ;
- états métier ;
- matrice API/permissions ;
- runbooks correction, publication, migration/activation ;
- feature flags ;
- couverture E2E ;
- dette restante ;
- dossier de validation humaine ;
- seuils de métriques et alertes attendues.

Commit ciblé :

`docs(bilans): add engine activation and review runbooks`

## Étape 9 — Gates et livraison

Exécuter :

```text
npm ci
npm run test -- --runInBand --silent
npm run test:db
npm run test:integration
npm run pre-rentree:pedagogy:verify
npm run pre-rentree:test:ts
npm run typecheck
npm run lint
npm run build
npm run security:repo
npx prisma validate
npx prisma generate
python -m pytest scripts/pre-rentree/tests -q
npx playwright test --config=playwright.ci.config.ts --project=chromium
```

Ajouter :

- tests de migration fresh et upgrade ;
- tests moteur ciblés ;
- E2E famille/équipe sur PostgreSQL et Redis réels ;
- checkout propre du SHA final.

Pousser sans force et ouvrir une draft PR vers
`fix/bilan-foundation-readiness-20260730`, avec la dépendance explicite.

