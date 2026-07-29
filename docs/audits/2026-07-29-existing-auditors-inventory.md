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

Colonne « Exécuté automatiquement » : **oui** = tourne réellement dans un pipeline sans action humaine ; **partiellement** = une partie tourne, une partie est manuelle ou décorative ; **non** = existe, ne tourne nulle part seul.

| Script | Portée | Exécuté automatiquement | Détail |
|---|---|---|---|
| `scripts/pre-rentree/final-public-release-audit.mjs` | Fuite interne + faits commerciaux dupliqués, pré-rentrée uniquement | **Partiellement** | `--source` via le test Jest, en CI. `--artifacts`/`--rendered` jamais exécutés — voir F1 |
| `scripts/marketing/public-content-audit.mjs` (nouveau, 2026-07-29) | Promesses marketing générales, siège/centre, délais, urgence artificielle — toutes pages publiques statiques, sur le RENDU | **Non** — préparé, non branché | voir F2 |
| `scripts/check-no-hardcoded.sh` (`npm run check:no-hardcoded`) | Champs de pricing supprimés, badge campagne, matricule fiscal, email, téléphone, nom d'entité — hors `lib/legal.ts`/`lib/whatsapp.ts` | **Non trouvé en CI** | à confirmer, probablement manuel/pré-commit local |
| `scripts/check-bundle-weight.sh` (`npm run check:bundle-weight`) | Poids du bundle de build | **Non trouvé en CI** | script existe, invocation CI non trouvée |
| `scripts/docs/check-archive-placement.js` (`npm run check:docs-archive`) | Emplacement des documents archivés | **Oui** | `ci.yml:162` |
| `scripts/audit-contrast.mjs` (`npm run audit:contrast`) | Contraste couleurs (accessibilité) | **Non trouvé en CI** | |
| `scripts/audit/site-map.mjs` (`npm run audit:site-map`) | Cartographie des routes du site | **Non trouvé en CI** | |
| `scripts/audit/link-allowlist.cjs` | Allowlist de liens | **Non trouvé en CI** | |
| `scripts/security/audit-api-guards.mjs` | Scanne les routes API pour vérifier la présence de guards RBAC | **Non trouvé en CI direct** | utilisé par `generate-api-security-matrix.mjs` et manuellement lors des lots go-live |
| `scripts/go-live/generate-api-security-matrix.mjs` | Génère la matrice de sécurité API (P0/P1/P2), citée dans PR #58 | **Non trouvé en CI** | |
| `scripts/security/check-no-private-keys.sh` | Clés privées commises par erreur | **Oui** | via `npm run security:repo`, `ci.yml:156` |
| `scripts/security/check-no-public-infrastructure.sh` | Informations d'infrastructure exposées publiquement | **Oui** | via `npm run security:repo` |
| `scripts/security/check-telegram-secrets.mjs` | Secrets/tokens Telegram commis | **Oui** | via `npm run security:repo` → `security:telegram` |
| `scripts/security/validate-dev-tooling-exception.mjs` | Exceptions d'outillage dev | Non vérifié | |
| `scripts/check-config.js` (`npm run check-config`) | Validation de configuration | **Non trouvé en CI direct** | |
| `scripts/check-production-build-env.js` | Variables d'environnement de build production | **Non trouvé en CI direct** | |
| `scripts/check-db-connection.ts` | Connexion base de données | Manuel | utilitaire |
| `scripts/database-consistency-check.js` | Cohérence base de données | Manuel | utilitaire |
| `scripts/release/verify-standalone-artifact.mjs` | Intégrité de l'artefact de build standalone | **Oui** | lié à `npm run build`/`artifact:audit`, `ci.yml:805` |
| `scripts/audit-production-artifact.js` (`npm run artifact:audit`) | Audit de l'artefact `.next/standalone` | **Oui** | `ci.yml:805` |
| `scripts/pre-rentree/verify_repository_hygiene.py`, `verify_release.py`, `verify_reproducibility.py`, `verify_public_pdfs.py`, `document_audit.py` | Suite de vérification pré-rentrée (hygiène dépôt, release, reproductibilité, PDF publics) | Manuel | `npm run pre-rentree:verify`/`pre-rentree:audit`, non trouvé en CI |
| `scripts/legacy/verify_all.sh` | Ancienne suite de vérification (préfixe `legacy`) | **Non** | probablement obsolète |
| `scripts/verify-workflow.js` / `.ts` | Vérification de workflow (doublon JS/TS à clarifier) | **Non trouvé en CI** | |
| `scripts/check-branch-ascendancy.sh`, `scripts/check-work-delivered.sh` | Hygiène de branches (créés dans cette mission) | **Non** | proposition CI en attente (`docs/proposals/ci-branch-inventory.yml`) |

**Constat pour la section E** : aucun auditeur existant ne couvre les règles marketing générales (AGENTS.md §3) ni la distinction siège social/centre pédagogique de façon systématique et site-large — seul un test unitaire ponctuel sur `/offres` le fait, page par page. Un auditeur de contenu à ce niveau serait donc réellement nouveau, pas une redite — mais son périmètre doit rester distinct de `final-public-release-audit.mjs` (qui est correctement scopé à la pré-rentrée) plutôt que de le remplacer ou le dupliquer.

## F1 — pourquoi `--artifacts` et `--rendered` ne tournent jamais

**Fonctionnent-ils encore ?** `--artifacts` : oui, testé directement contre le build local (`node scripts/pre-rentree/final-public-release-audit.mjs --artifacts`), exit code 1 avec 2 findings réels. `--rendered` : ne peut pas être testé en l'état — il exige un `<capture-directory>` en argument, et **aucun script du dépôt ne produit une telle capture**. Ce mode consomme une entrée que rien ne fabrique.

**Pourquoi `--artifacts` n'est pas câblé** : testé en conditions réelles, il produit des faux positifs sur du code tiers/webpack (`internal-token: .next/static/chunks/webpack.js:1015: TODO`, un `todo` minifié dans un chunk vendor) — le motif `\bTODO\b` matche du bruit de bundler, pas du contenu applicatif. Câblé tel quel en CI, il ferait échouer systématiquement le build sans rapport avec un vrai problème de fuite. C'est la cause la plus probable de son abandon, pas l'oubli ou le coût : le script fonctionne, son signal est bruité.

**Pourquoi `--rendered` n'est pas câblé** : aucune tâche ne produit son entrée. Ce n'est pas qu'il soit cassé — il n'a simplement jamais eu de producteur. C'est exactement le type de « travail écrit, jamais appelé » documenté ailleurs dans ce dossier, à un niveau plus fin (un mode de script, pas une branche entière).

## I — `--rendered` : coquille vide, résolue ; `--artifacts` : recommandation tranchée

**I1 — le nouvel auditeur peut-il alimenter `--rendered` ?** Oui, directement, sans doublon : `scripts/marketing/public-content-audit.mjs` récupère déjà le rendu réel de chaque page ; `--rendered` (dans `final-public-release-audit.mjs`) vérifie une chose **différente** de l'auditeur marketing — les fuites de vocabulaire interne (`internalTokenPatterns` : identifiants de gate, rôles internes, `TODO`/`FIXME`), pas les promesses commerciales. Ce ne sont pas deux outils qui se recouvrent, ce sont deux contrôles complémentaires qui avaient besoin de la même matière première (une capture de rendu), que rien ne produisait.

**I2 — deux issues, pas trois. Décision : brancher, pas supprimer.** `scripts/marketing/public-content-audit.mjs` a reçu un flag `--save-html <dir>` qui sauvegarde le HTML brut de chaque page pendant qu'il scanne son propre contenu — il devient le producteur manquant. Vérifié de bout en bout, en local :

```
$ node scripts/marketing/public-content-audit.mjs --base-url http://127.0.0.1:3910 --save-html /tmp/capture
→ 37 pages capturées
$ node scripts/pre-rentree/final-public-release-audit.mjs --rendered /tmp/capture
internal-token: .../capture/stages.html:2: pre2026-pack-
exit: 1
```

**`--rendered`, une fois alimenté, trouve un vrai résultat** : l'identifiant de pack interne `pre2026-pack-` fuit dans le HTML rendu de `/stages` (probablement un attribut `data-*` ou un id/className non nettoyé). C'est exactement le genre de choses qu'un scan de sources seules ne peut pas voir. `--rendered` n'était pas une coquille vide par défaut de conception — juste par absence de producteur, maintenant comblée.

**I3 — `--artifacts` : recommandation = corriger et brancher, pas supprimer.** Le diagnostic (bruit `TODO`/`todo` dans `webpack.js` et un chunk vendor) est localisé et peu coûteux à corriger : restreindre `relevantArtifactFiles()` aux chunks sous `chunks/app/**`, exclure explicitement `chunks/webpack.js` et tout chemin contenant `node_modules`. Le script fonctionne déjà et son signal utile (le mode existe, cite ses propres tests de couverture) ne justifie pas une suppression — seulement un filtrage. Argument : supprimer un détecteur qui marche à 90 % pour un problème de filtrage à 10 % jette le travail avec le bruit ; c'est le même raisonnement qui a permis de sauver `--rendered` plutôt que de l'abandonner.

Aucun des deux n'a été branché en CI ni rendu bloquant — modifications de scripts uniquement, aucun contenu marketing touché, conformément à H4.

Aucun des deux n'a été branché — proposition seulement, conformément à la consigne.

## F2 — auditeur marketing général, préparé

`scripts/marketing/public-content-audit.mjs` — nouveau, non branché en CI, non ajouté à `package.json`.

**Portée** : les 39 pages publiques statiques du dépôt (`find app -name page.tsx`, hors `dashboard`/`api`/segments dynamiques — ces derniers hors périmètre car ils exigent un slug valide pour être rendus). Scanne le **rendu réel** (fetch HTTP contre un serveur qui tourne, texte visible extrait du HTML), pas seulement les sources — une valeur peut venir d'une donnée, pas seulement d'un littéral de code.

**6 catégories de contrôle**, dérivées d'AGENTS.md §3 et de la demande : résultat/garantie/taux de réussite, "essayer gratuitement" sans accès gratuit (signalé pour revue humaine — le script ne peut pas lui-même prouver l'absence d'accès gratuit), compte à rebours/rareté artificielle, confusion Centre Urbain Nord/Mutuelleville sur page commerciale, promesse de délai non instrumentée, nom d'enseignant publié (heuristique, chaque correspondance exige une relecture humaine).

**Testé localement (serveur `next dev` local, jamais contre la production) — résultat réel, 29 findings sur 37 pages atteignables après correctif de déduplication** (34 bruts avant correctif — voir `docs/audits/2026-07-29-marketing-content-findings-triage.md` pour le triage complet) :
- **`siege-centre-confusion` sur 21 pages, 1 seule cause racine** : confirme, en conditions réelles et indépendamment, le bug déjà connu du panneau de contact rapide mobile (`CorporateNavbar.tsx`) qui affiche « Centre Urbain Nord » au lieu de Mutuelleville sur les pages commerciales — première validation externe de ce constat par un outil différent.
- **`delai-non-instrumente` : 8 occurrences réelles, 2 textes distincts** (« Réponse sous 24 h ouvrées » sur 6 pages, un bloc CTA/footer partagé ; « Être rappelé(e) sous 24 h » sur 2 pages) — une promesse de délai jamais mesurée ni instrumentée.
- 2 pages non atteignables en local (`/admin/directeur`, `/programme/maths-1ere-stmg`) — nécessitent probablement une session ou des données de seed absentes en dev ; limite connue, pas un défaut du script.
- 0 finding sur les 4 autres catégories (résultat garanti, essai gratuit sans accès, urgence artificielle, nom d'enseignant publié).

**Non branché** : ni en CI, ni en `package.json`, ni bloquant. Prêt à être revu et, sur décision, activé en mode non bloquant d'abord (comme le job d'inventaire de branches).
