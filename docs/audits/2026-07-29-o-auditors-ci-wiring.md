# O — branchement CI des trois auditeurs (non bloquant)

Date : 2026-07-29

## O1 — `--artifacts` restreint et corrigé

Deux couches de correction, l'une insuffisante seule :

1. **Portée de fichiers** (`isVendorOrFrameworkChunk`) : exclut les chunks vendor/framework identifiables par leur NOM de fichier (`webpack.js`, `main-*`, `framework-*`, `polyfills-*`) — corrige le premier faux positif trouvé (`chunks/webpack.js:1015: TODO`).
2. **Insuffisant seul** : re-testé contre un build réel, 6 nouveaux findings sont apparus dans les chunks applicatifs eux-mêmes (`chunks/app/page.js`, `chunks/app/layout.js`, `chunks/app/stages/pre-rentree-2026/page.js`) — parce que webpack **regroupe parfois du code tiers directement dans le chunk de la page**, sans fichier séparé à exclure par chemin.

Chaque finding vérifié individuellement par son contexte exact :

| Finding | Contexte réel | Verdict |
|---|---|---|
| `internal only` (×2) | `@auth/core` (NextAuth) : « the config object is internal only » | Code tiers, faux positif |
| `todo` (×2) | Tailwind CSS (`@todo class group will be renamed`) et NextAuth (`/** @todo */ class ClientFetchError`) | Code tiers, faux positif |
| `PRE_REGISTRATION_OPEN` | Clé d'une table de traduction `formatCampaignStatus()` (`PRE_REGISTRATION_OPEN: 'Pré-inscriptions ouvertes'`) | Code Nexus légitime — seul le libellé français est jamais affiché |
| `DRAFT` | Même table (`DRAFT: 'Campagne en préparation'`) | Idem |

**Mécanisme retenu** : liste d'exceptions explicite et documentée (`ARTIFACT_KNOWN_EXCEPTIONS` dans `final-public-release-audit.mjs`), chaque entrée commentée avec sa justification, matchée sur le contexte exact du finding (pas le simple mot) — une nouvelle occurrence non listée continue de déclencher une vraie alerte. C'est la voie « liste d'exceptions justifiée » de la condition O3, pas la voie « zéro finding par construction » — plus honnête qu'un nouvel assouplissement de motif qui risquerait de masquer un vrai futur problème.

Résultat après les deux corrections, testé contre un build réel : **`--artifacts` : 0 finding.** `--source` : 0 finding (inchangé). `--rendered` (capture réelle des 37 pages publiques) : **1 finding, déjà connu et déjà corrigé sur une branche séparée** (`pre2026-pack-` sur `/stages` — voir `docs/audits/2026-07-29-stages-page-internal-data-leak.md`), pas un nouveau bruit.

## O2 — `--rendered` alimenté

Déjà livré (voir triage précédent) : `scripts/marketing/public-content-audit.mjs --save-html <dir>` produit la capture, `final-public-release-audit.mjs --rendered <dir>` la consomme. Revérifié dans ce tour avec la version corrigée de `--artifacts` : cohérent, un seul vrai finding, déjà tracé.

## O3 — condition remplie

Les trois auditeurs tournent aujourd'hui sur l'état actuel du dépôt avec :
- `--source` : 0 finding ;
- `--artifacts` : 0 finding (après filtrage du bruit vendor/framework + liste d'exceptions justifiée, 6/6 revues individuellement) ;
- `--rendered` (`public-content-audit.mjs` + `--save-html`) : 1 finding, déjà qualifié et déjà corrigé sur `fix/pricing-public-view-strip-internal-fields` (non encore fusionnée — donc encore présent tant que cette branche n'est pas intégrée, ce qui est cohérent, pas un faux positif).

## O4 — branché non bloquant

Job `public-content-audit` ajouté à `.github/workflows/ci.yml`, après le job `build` (réutilise son artefact de build), avec `continue-on-error: true` au niveau du job ET de chaque étape d'audit — **volontairement absent de la liste `needs` de `ci-success`**, vérifié par un parseur YAML (`'public-content-audit' in ci-success.needs` → `False`). Un finding dans ce job n'empêche aucun merge ni déploiement ; il produit un signal visible dans l'onglet Actions, à surveiller sur plusieurs exécutions avant d'envisager un passage en bloquant.

**Réserve honnête à signaler** : l'étape « Download build artifacts » utilise `actions/download-artifact@v6` (référence par tag), **pas un SHA épinglé** comme le reste de ce fichier (convention du dépôt pour le durcissement de la chaîne d'approvisionnement). Je n'ai pas de SHA vérifié pour cette action et j'ai choisi de ne pas en inventer un — inventer une référence de sécurité aurait été pire que de ne pas épingler du tout. Ce point doit être corrigé (SHA réel vérifié) avant que ce job soit jugé conforme au reste du fichier.

Non fusionné, non déployé — modifications sur `feat/bilan-gratuit-audit` (le job CI et le correctif `--artifacts` vivent avec le reste des outils de cette mission).
