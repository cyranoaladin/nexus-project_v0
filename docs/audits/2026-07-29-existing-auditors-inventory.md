# Inventaire des auditeurs et scripts de vérification existants

Date : 2026-07-29
Objectif : recenser ce qui existe déjà avant d'envisager d'écrire un nouvel auditeur de contenu (Lot E).

## `scripts/pre-rentree/final-public-release-audit.mjs` (C1-C3)

**Périmètre** : une allowlist FIXE de 12 fichiers/dossiers spécifiques à la campagne Pré-rentrée 2026 (`CorporateNavbar.tsx`, `PreRentreeCampaignSpotlight.tsx`, `app/stages/page.tsx`, `app/HomePageClient.tsx`, `lib/analytics.ts`, etc.) — **pas un auditeur général du site.**

**Contrôles (C1)** :
1. `internalTokenPatterns` (tous modes) — vocabulaire interne qui ne doit jamais fuiter en public : statuts de gate (`PRE_REGISTRATION_OPEN`, `OWNER_INPUT_REQUIRED`, `PENDING_EVIDENCE`...), identifiants de rôle interne (`MATHS_NSI_SNT_TEACHER`, `FRENCH_TEACHER`...), `TODO`/`FIXME`, `DRAFT`/`LEGACY`, mentions de salle/rôle logique.
2. `copiedBusinessFactPatterns` (mode `--source` seulement) — faits commerciaux dupliqués en dur au lieu de venir de la source canonique : prix (480/900/1350/1800/140/270/410/540...), dates (17/28/10 août), créneaux horaires (08:30, 10:45...), le numéro WhatsApp, les phrases d'effectif (« 3 à 5 élèves »).

**3 modes** : `--source` (fichiers source), `--artifacts` (bundle Next.js construit, classification browser/serveur), `--rendered` (capture HTML rendue).

**C2 — exécution automatique ou manuelle ?** Partiellement automatique. Le test `__tests__/campaigns/pre-rentree-2026-final-public-release.test.ts` exécute réellement le mode `--source` via `execFileSync`, et ce test tourne en CI (`npm test`, invoqué dans `.github/workflows/ci.yml:233`). **Mais** le test « provides build artifact and rendered payload scan modes » ne fait que vérifier que le code source du script contient les chaînes `--artifacts`/`--rendered` — il ne les exécute jamais. Les modes `--artifacts` et `--rendered` existent mais ne tournent nulle part automatiquement ; ils exigent une exécution manuelle après un build ou une capture de rendu.

**C3 — couvre-t-il les règles marketing générales (AGENTS.md §3) ?** Non, aucun des deux jeux de motifs ne référence : promesse de résultat garanti, taux de réussite, "100% ou remboursé", compte à rebours, "essayer gratuitement" sans accès gratuit, ou la confusion siège social / centre pédagogique. Cet auditeur est strictement scopé à la fuite d'information interne et à la duplication de faits commerciaux **de la campagne pré-rentrée**, pas à la conformité marketing générale du site.

## C4 — inventaire complet des auditeurs et scripts de vérification du dépôt

| Script | Portée | Câblé en CI ? |
|---|---|---|
| `scripts/pre-rentree/final-public-release-audit.mjs` | Fuite interne + faits commerciaux dupliqués, pré-rentrée uniquement | Partiel — `--source` via le test Jest ; `--artifacts`/`--rendered` manuels |
| `scripts/check-no-hardcoded.sh` (`npm run check:no-hardcoded`) | Champs de pricing supprimés, badge campagne, matricule fiscal, email, téléphone, nom d'entité — hors `lib/legal.ts`/`lib/whatsapp.ts` | Non trouvé dans `.github/workflows/*.yml` — à confirmer, probablement manuel/pré-commit local |
| `scripts/check-bundle-weight.sh` (`npm run check:bundle-weight`) | Poids du bundle de build | Non câblé directement en CI (script existe, invocation CI non trouvée) |
| `scripts/docs/check-archive-placement.js` (`npm run check:docs-archive`) | Emplacement des documents archivés | **Oui** — `ci.yml:162` |
| `scripts/audit-contrast.mjs` (`npm run audit:contrast`) | Contraste couleurs (accessibilité) | Non trouvé en CI |
| `scripts/audit/site-map.mjs` (`npm run audit:site-map`) | Cartographie des routes du site | Non trouvé en CI |
| `scripts/audit/link-allowlist.cjs` | Allowlist de liens | Non trouvé en CI |
| `scripts/security/audit-api-guards.mjs` | Scanne les routes API pour vérifier la présence de guards RBAC | Non trouvé en CI direct (utilisé par `generate-api-security-matrix.mjs` et manuellement lors des lots go-live) |
| `scripts/go-live/generate-api-security-matrix.mjs` | Génère la matrice de sécurité API (P0/P1/P2), citée dans PR #58 | Non trouvé en CI |
| `scripts/security/check-no-private-keys.sh` | Clés privées commises par erreur | **Oui** — via `npm run security:repo`, `ci.yml:156` |
| `scripts/security/check-no-public-infrastructure.sh` | Informations d'infrastructure exposées publiquement | **Oui** — via `npm run security:repo` |
| `scripts/security/check-telegram-secrets.mjs` | Secrets/tokens Telegram commis | **Oui** — via `npm run security:repo` → `security:telegram` |
| `scripts/security/validate-dev-tooling-exception.mjs` | Exceptions d'outillage dev | Non vérifié |
| `scripts/check-config.js` (`npm run check-config`) | Validation de configuration | Non trouvé en CI direct |
| `scripts/check-production-build-env.js` | Variables d'environnement de build production | Non trouvé en CI direct |
| `scripts/check-db-connection.ts` | Connexion base de données | Utilitaire, probablement manuel |
| `scripts/database-consistency-check.js` | Cohérence base de données | Utilitaire, probablement manuel |
| `scripts/release/verify-standalone-artifact.mjs` | Intégrité de l'artefact de build standalone | Lié à `npm run build`/`artifact:audit`, `ci.yml:805` (`artifact:audit`) |
| `scripts/audit-production-artifact.js` (`npm run artifact:audit`) | Audit de l'artefact `.next/standalone` | **Oui** — `ci.yml:805` |
| `scripts/pre-rentree/verify_repository_hygiene.py`, `verify_release.py`, `verify_reproducibility.py`, `verify_public_pdfs.py`, `document_audit.py` | Suite de vérification pré-rentrée (hygiène dépôt, release, reproductibilité, PDF publics) | Manuel (`npm run pre-rentree:verify`/`pre-rentree:audit`), non trouvé en CI |
| `scripts/legacy/verify_all.sh` | Ancienne suite de vérification (préfixe `legacy`) | Non câblé, probablement obsolète |
| `scripts/verify-workflow.js` / `.ts` | Vérification de workflow (doublon JS/TS à clarifier) | Non trouvé en CI |
| `scripts/check-branch-ascendancy.sh`, `scripts/check-work-delivered.sh` | Hygiène de branches (créés dans cette mission) | Non câblés — proposition CI en attente (`docs/proposals/ci-branch-inventory.yml`) |

**Constat pour la section E** : aucun auditeur existant ne couvre les règles marketing générales (AGENTS.md §3) ni la distinction siège social/centre pédagogique de façon systématique et site-large — seul un test unitaire ponctuel sur `/offres` le fait, page par page. Un auditeur de contenu à ce niveau serait donc réellement nouveau, pas une redite — mais son périmètre doit rester distinct de `final-public-release-audit.mjs` (qui est correctement scopé à la pré-rentrée) plutôt que de le remplacer ou le dupliquer.
