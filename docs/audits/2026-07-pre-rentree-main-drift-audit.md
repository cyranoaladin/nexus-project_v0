# Audit de dérive de `origin/main` — Pré-rentrée 2026

## Statut

- Date de contrôle : 11 juillet 2026
- Dépôt : `cyranoaladin/nexus-project_v0`
- Base initialement auditée : `11ac38cea728e5d4eba66ca2b549cfc080ec835f`
- `origin/main` après `git fetch origin --prune` : `db04d23f3e645a2052e41e5a679a8b9443cf8dc9`
- `main` local observé : `db8545a19c0e0f1d33f5197c29c3cafa492adc00`
- Merge-base : `6060a3e6300123731c2231c8b8aee7af76de0169`
- Verdict : **dérive réelle, sans invalidation du modèle métier ; qualification de sécurité requise avant implémentation**

Ce rapport complète l'[audit système initial](./2026-07-pre-rentree-system-impact-audit.md). Il n'autorise aucune modification applicative.

## Résumé exécutif

`origin/main` n'est pas un descendant direct du commit audité. La branche auditée contient 49 commits après le merge-base, alors que `origin/main` contient un commit de merge après ce même point. La comparaison `11ac38c..origin/main` recense 59 fichiers, 399 insertions et 2 196 suppressions. Ces nombres décrivent une **divergence de branches**, pas une chronologie où `main` aurait volontairement supprimé chaque correction.

Les frontières métier de la Pré-rentrée ne dérivent pas : aucune différence dans Prisma, les migrations, le catalogue pricing, les services pricing, les pages publiques Stage/Offres, les routes Stage, les dashboards Stage, `BusinessConfig` ou les notifications. Le modèle V1, ses limites et la recommandation V2 additive restent donc valides.

La dérive touche néanmoins le socle de sécurité général : guards, validation de dates, téléchargement de documents, webhook ClicToPay, permissions de factures, email, scripts de gates et tests de sécurité. Plusieurs durcissements présents dans `11ac38c` ne sont pas dans `origin/main`. La conception physique peut commencer, mais aucun développement Stage ne devra prendre la branche auditée comme preuve que ces protections existent sur `main`.

## Topologie Git constatée

```text
6060a3e63  merge-base
├── 49 commits supplémentaires vers 11ac38cea (base auditée)
└── db04d23f3 (merge PR #60 sur origin/main)
```

Conséquences :

- le cherry-pick des documents sur `origin/main` est légitime car il transporte seulement leur diff documentaire ;
- les affirmations de structure métier restent appuyées par des fichiers inchangés ;
- les affirmations positives de sécurité doivent être revérifiées sur le SHA de développement retenu ;
- toute future branche physique doit partir d'un `origin/main` fraîchement fetché et enregistrer ce SHA.

## Matrice des domaines demandés

| Domaine | Dérive depuis `11ac38c` | Classe | Conclusion |
|---|---|---|---|
| `prisma/schema.prisma` | aucune | sans impact | Modèles `User`, `Student`, `ParentProfile`, `CoachProfile`, `Stage*` identiques |
| `prisma/migrations` | aucune | sans impact | Aucun changement de migration à intégrer à l'audit |
| `data/pricing.canonical.json` | aucune | sans impact | Règles de plancher, acompte et groupes inchangées |
| `lib/pricing.ts` | aucune | sans impact | Getters et calculs canoniques inchangés |
| pricing client/généré | aucune | sans impact | Contrat de projection inchangé |
| `lib/stages` | message Zod seulement dans `inscription-schema.ts` | impact documentaire | Les deux consentements restent `literal(true)` et le schéma reste strict |
| `app/stages`, `components/stages` | aucune | sans impact | Double projection JSON/DB et dette frontend toujours présentes |
| `app/offres` | aucune | sans impact | Catalogue annuel inchangé |
| routes API Stage | aucune | sans impact | Capacité non transactionnelle et flux historique inchangés |
| formulaires Stage | aucune | sans impact | Conclusions identité/accessibilité inchangées |
| dashboards Stage | aucune | sans impact | Limites admin/coach/parent/élève inchangées |
| authentification/guards | `lib/guards.ts` diffère | impact sécurité | Sur `origin/main`, `requireAuth` ne transforme pas une exception `auth()` en 401 contrôlé |
| rôles/permissions | permissions factures et plusieurs routes diffèrent | impact sécurité | Rejouer la matrice RBAC/IDOR sur la future branche |
| `BusinessConfig` | aucune | sans impact | Le risque de source parallèle reste celui documenté |
| paiements | webhook ClicToPay et stockage facture diffèrent | impact sécurité | Ne pas activer le paiement Stage avant fail-closed et preuves bout-en-bout |
| factures | validation date et scope Assistante diffèrent | impact métier | Règles financières/permissions à figer dans les DTO V2 |
| notifications | aucune dans les services dédiés | sans impact | L'absence d'outbox Stage reste confirmée |
| modèles User/Student/Parent/Coach/Stage | aucune | sans impact | La migration additive reste nécessaire |

## Différences sémantiques significatives

### DRIFT-SEC-001 — guards d'authentification

Dans la base auditée, `requireAuth` capture une exception de `auth()` et renvoie une réponse 401. Dans `origin/main`, l'appel peut propager l'exception. Ce point ne change pas le modèle V2, mais interdit de considérer les guards actuels comme une preuve suffisante de comportement fermé et uniforme.

Classe : **impact sécurité**. Gate associé : tests 401/403, erreurs d'auth et IDOR sur le SHA cible.

### DRIFT-SEC-002 — webhook ClicToPay

Dans la base auditée, l'absence de secret désactive explicitement le webhook avant lecture du corps et la signature est obligatoire. Dans `origin/main`, la vérification HMAC est conditionnelle à la présence du secret ; la route termine encore en 501 et ne matérialise pas de paiement, mais le contrat fail-closed est moins strict.

Classe : **impact sécurité**. La Pré-rentrée ne peut pas activer les paiements sur ce comportement.

### DRIFT-ARCH-003 — validation des dates civiles

Le helper strict de date civile présent dans la base auditée n'existe pas sur `origin/main`; les factures utilisent une datetime. Le domaine V2 doit donc fournir son propre contrat `CivilDate` + fuseau IANA au lieu de présumer ce helper disponible.

Classe : **impact architectural**. La recommandation `CivilDate`/`Africa/Tunis` reste valide et devient un prérequis explicite.

### DRIFT-SEC-004 — documents et stockage

La route sécurisée de téléchargement et le helper de racine de stockage présents dans la base auditée ne sont pas dans `origin/main`. La Pré-rentrée ne doit pas réutiliser une URL ou un chemin local comme autorisation d'accès à un support pédagogique.

Classe : **impact sécurité**. Les documents V2 exigent une route autorisée par audience et cohorte.

### DRIFT-ID-005 — création enfant et activation

La base auditée améliore le parsing JSON et l'envoi d'activation au parent ; `origin/main` ne possède pas ces durcissements. Cela renforce la décision de ne pas copier le flux existant pour transformer une demande publique en comptes définitifs.

Classe : **impact sécurité** et **impact métier**.

### DRIFT-DOC-006 — schéma public Stage

Les messages personnalisés des deux consentements sont absents de `origin/main`, mais les valeurs exigées et le `.strict()` sont identiques. Le constat initial « consentements obligatoires » reste exact.

Classe : **impact documentaire** uniquement.

## Inventaire exhaustif des 59 fichiers

| Fichier | Classe principale | Effet sur Pré-rentrée 2026 |
|---|---|---|
| `__tests__/api/bilans.generate.idor.test.ts` | impact sécurité | Couverture IDOR plus faible sur `main`; pattern à rétablir pour V2 |
| `__tests__/api/bilans.idor.test.ts` | impact sécurité | Assertions d'ownership différentes |
| `__tests__/api/bilans/generate.test.ts` | impact sécurité | Scope de génération à revalider |
| `__tests__/api/coach.bilan-diagnostic-maths-terminale.security.test.ts` | impact sécurité | Couverture coach/élève à rejouer |
| `__tests__/api/documents-access.test.ts` | impact sécurité | Projection et accès documents moins couverts |
| `__tests__/api/documents-download.test.ts` | impact sécurité | Route de téléchargement sécurisée absente de `main` |
| `__tests__/api/invoices.issuedAt.test.ts` | impact métier | Validation des dates de facture moins couverte |
| `__tests__/api/lamis.teacher-report.route.test.ts` | sans impact | Fonctionnalité distincte ajoutée côté `main` |
| `__tests__/api/parent.children.activation.route.test.ts` | impact sécurité | Activation d'identité à revalider |
| `__tests__/api/parent.children.route.test.ts` | impact sécurité | Parsing et liaison enfant différents |
| `__tests__/api/payments.clictopay.webhook.test.ts` | impact sécurité | Fail-closed du webhook non couvert comme dans la base auditée |
| `__tests__/api/sessions.video.route.test.ts` | impact sécurité | Rate-limit/auth d'une route privée diffèrent |
| `__tests__/lib/invoice/access-scope.test.ts` | impact sécurité | Scope Assistante différent |
| `__tests__/scripts/audit-api-guards.classification.test.ts` | impact sécurité | Inventaire automatique des guards moins strict |
| `__tests__/scripts/fixtures/secret-scan/gate-benign.sample` | impact sécurité | Fixture de gate absente |
| `__tests__/scripts/fixtures/secret-scan/gate-malicious.sample` | impact sécurité | Fixture de gate absente |
| `__tests__/scripts/fixtures/secret-scan/gate-nextauth-hardcoded.sample` | impact sécurité | Fixture secret absente |
| `__tests__/scripts/fixtures/secret-scan/gate-nextauth.sample` | impact sécurité | Fixture secret absente |
| `__tests__/scripts/fixtures/secret-scan/gate-postgres-quoted.sample` | impact sécurité | Fixture secret absente |
| `__tests__/scripts/pre-commit-hook.test.ts` | impact sécurité | Hook fail-closed moins couvert |
| `__tests__/scripts/seed-e2e-guard.test.ts` | impact migration | Protection de la base de seed moins couverte |
| `app/api/admin/directeur/stats/route.ts` | impact sécurité | Guard admin à revalider |
| `app/api/admin/documents/route.ts` | impact sécurité | Projection document différente |
| `app/api/admin/invoices/route.ts` | impact métier | Dates et total client traités différemment |
| `app/api/admin/recompute-ssn/route.ts` | impact sécurité | Guard admin différent, hors Stage direct |
| `app/api/admin/test-email/route.ts` | impact sécurité | Guard admin différent |
| `app/api/assistante/students/credits/route.ts` | impact sécurité | Portée Assistante/parent/élève différente |
| `app/api/assistante/subscriptions/route.ts` | impact sécurité | Guard Assistante différent |
| `app/api/bilan-gratuit/dismiss/route.ts` | impact sécurité | Parsing/guard moins homogène |
| `app/api/bilans/[id]/export/route.ts` | impact sécurité | Scope bilan différent |
| `app/api/bilans/[id]/route.ts` | impact sécurité | Ownership différent |
| `app/api/bilans/generate/route.ts` | impact sécurité | Scope de génération différent |
| `app/api/bilans/route.ts` | impact sécurité | Projection/ownership différents |
| `app/api/coach/students/[studentId]/bilan-diagnostic-maths-terminale/route.ts` | impact sécurité | Accès coach/élève différent |
| `app/api/coach/students/[studentId]/documents/route.ts` | impact sécurité | Stockage et projection document différents |
| `app/api/coach/trajectory/route.ts` | impact sécurité | Contrôle coach/élève différent |
| `app/api/documents/[id]/download/route.ts` | impact sécurité | Route absente de `main` |
| `app/api/lamis/teacher-report/route.ts` | sans impact | Fonctionnalité distincte ajoutée côté `main` |
| `app/api/parent/children/route.ts` | impact métier | Activation et rapprochement d'identité à ne pas réutiliser |
| `app/api/parent/subscription-requests/route.ts` | impact sécurité | Scope parent différent |
| `app/api/payments/clictopay/webhook/route.ts` | impact sécurité | Secret HMAC non strictement fail-closed |
| `app/api/payments/validate/route.ts` | impact sécurité | Racine de stockage différente |
| `app/api/sessions/video/route.ts` | impact sécurité | Rate-limit/auth différents |
| `app/dashboard/admin/tests/page.tsx` | sans impact | Page de tests distincte |
| `docs/go-live/api-security-matrix.full.md` | impact documentaire | Inventaire de sécurité différent |
| `docs/security/API_GUARD_INVENTORY.md` | impact documentaire | Inventaire de guards différent |
| `lib/api/helpers.ts` | impact architectural | Helper de parsing discriminé absent |
| `lib/documents/storage-root.ts` | impact sécurité | Absent de `main`; ne pas présumer une racine sûre |
| `lib/e2e/seed-guard.ts` | impact migration | Absent de `main`; sécuriser toute future fixture/migration |
| `lib/email/templates.ts` | impact sécurité | Helper d'échappement non exporté |
| `lib/guards.ts` | impact sécurité | Exception `auth()` non normalisée |
| `lib/invoice/not-found.ts` | impact métier | Accès Assistante différent |
| `lib/stages/inscription-schema.ts` | impact documentaire | Messages Zod seulement, invariant inchangé |
| `lib/validation/common.ts` | impact architectural | Date civile stricte absente |
| `scripts/gate-all.sh` | impact sécurité | Gate global moins durci |
| `scripts/go-live/generate-api-security-matrix.mjs` | impact sécurité | Classification de guards différente |
| `scripts/pre-commit-hook.sh` | impact sécurité | Scan secret/hook moins durci |
| `scripts/security/audit-api-guards.mjs` | impact sécurité | Inventaire automatique moins strict |
| `scripts/seed-e2e-db.ts` | impact migration | Guard de base E2E différent |

## Documents affectés

| Document | État après synchronisation | Action dans cette phase |
|---|---|---|
| Audit dates/planning | valide | aucune correction |
| Planning 60 séances | valide | aucune correction |
| ADR 004 | valide | aucune correction |
| Audit système initial | valide comme photographie de `11ac38c` | présent rapport ajoute la qualification `origin/main` |
| Décisions métier | obsolète sur les statuts « à valider » | remplacées explicitement par OWNER-001 à OWNER-022 |
| Contrat source de vérité | architecture désormais approuvée | statut et règles `BusinessConfig` mis à jour |
| Intégration utilisateurs/dashboards | architecture valide | visibilité financière et multi-responsables figées |
| Stratégie migration | valide | SHA de départ, archivage logique et flags distincts ajoutés |
| Matrice de tests | valide mais incomplète face à la dérive | gates auth/webhook/date/documents ajoutés |
| Carte de propriété | valide | nouvelles routes/codes/gates attribués sans implémenter |
| ADR 005 | proposition devenue décision acceptée | statut remplacé avec traçabilité OWNER-017/018 |

Aucun document de planning ou de calcul devient obsolète. Seuls les statuts de décision et certaines présomptions de durcissement du socle sont corrigés.

## Risques restants

### P0 avant publication

- branche d'implémentation non encore fixée sur un socle de guards vérifié ;
- webhook/paiement Stage non démontré fail-closed et idempotent ;
- identité multi-responsables et contrôles IDOR non implémentés ;
- coûts/marge, ressources et CGV non validés.

### P1 avant merge applicatif

- helper date civile absent du `main` courant ;
- stockage/accès documents à concevoir sans dépendre des corrections non mergées ;
- couverture de security gates différente entre la base auditée et `main` ;
- permissions Assistante/factures à figer explicitement.

### P2 de consolidation

- local `main` en retard sur `origin/main` ;
- inventaires de sécurité et scripts de gates divergents ;
- pages et contenus Stage historiques toujours dispersés.

## Conclusion

La dérive n'invalide ni les 60 séances, ni les tarifs décidés, ni l'architecture V2 additive. Elle impose que la conception physique parte de `origin/main` et n'emprunte aucun helper de la base `11ac38c` sans vérifier qu'il existe réellement sur le SHA cible.

Statut de sortie de l'audit de dérive : **MAIN_DRIFT_DOCUMENTED — PHYSICAL_SCHEMA_DESIGN_NOT_BLOCKED, PUBLICATION_BLOCKED_BY_GATES**.
