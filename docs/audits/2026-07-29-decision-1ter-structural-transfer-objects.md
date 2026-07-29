# Décision 1ter — la vraie réponse est structurelle : objets de transfert explicites par source

Date : 2026-07-29
Principe : une liste blanche de champs publiés, jamais une liste noire de champs à cacher — un test qui échoue sur tout champ non listé, y compris les tableaux (angle mort de la détection inversée).

## 1ter.1 / 1ter.2 — sources sensibles alimentant des pages publiques, statut actuel

| Source | Objet de transfert explicite existe-t-il ? | Détail |
|---|---|---|
| `pricing.canonical.json` — `getCarte()` | **Non → corrigé** | `getPublicCarte()` ajouté sur `fix/pricing-public-view-strip-internal-fields` (`rationale` retiré) |
| `pricing.canonical.json` — `getStageCalendar()` | **Non → corrigé** | `getPublicStageCalendar()`, même branche (`pack_product_ids` retiré, `notes` conservé — champ réellement affiché) |
| `pricing.canonical.json` — `getStageFormat()`/`getStageFormats()` | **Oui, déjà existant** | Type `StageFormat` distinct de `StageFormatRaw` (`[key:string]: unknown`), filtre déjà les champs `_*` — testé (`pricing-public-api.test.ts`) |
| `pricing.canonical.json` — `getFullPricingData()` | **Oui, par le contexte d'appel** | Seul appelant : `lib/assistante-devis-catalog.ts`, consommé uniquement par `app/dashboard/assistante/devis/assets/[file]/route.ts`, vérifié gardé par `requireAnyRole([ADMIN, ASSISTANTE])` — hors périmètre "page publique", pas un objet de transfert au sens de ce lot mais un accès authentifié vérifié |
| `campaigns/pre-rentree-2026.json` — `getPreRentreeCampaign()` | **Oui, déjà existant** | `import 'server-only'` (ne peut structurellement pas atteindre un composant client) ; seul appelant applicatif (`app/bilan-gratuit/page.tsx`) reconstruit un objet `prefill` explicite, champ par champ — vérifié dans le tour précédent |
| `publication-decisions.owner.json` | **Sans objet — jamais lu par aucun code aujourd'hui** | Va le devenir avec la Décision 5 (`canShowPreRentreeInPermanentNav()`) — construit dès l'origine comme une extraction d'un seul booléen, jamais un passage de l'objet complet (voir Décision 5) |
| `content/pre-rentree-2026/**` — `getPreRentreePublicSurfaceDTO()` | **Oui, déjà existant** | Reconstruit champ par champ (confirmé dans un tour précédent) |
| `content/pre-rentree-2026/**` — `compileCommercialPublicationContract()` | **Non — risque dormant, pas une fuite active, corrigé par un test** | Calcule `pricingExceptions` (portant `justification`, structurellement identique à `carte_nexus.rationale`) dans le MÊME objet de retour que `offers` (le flux public). Aucun des 3 appelants actuels (`public-surface.ts`, `campaign-facts.ts`, `whatsapp-conversion.ts`) ne propage `pricingExceptions` vers une page — vérifié par grep, aucune occurrence hors de `commercial-contract.ts` lui-même. Mais rien n'empêchait un futur appelant de le faire par un simple `{...contract}`. |

## 1ter.3 — généralisation appliquée

Le seul cas sans garde-fou réel était `compileCommercialPublicationContract()`. Contrairement à `getCarte()`/`getStageCalendar()`, il n'y avait pas de fuite active à corriger (aucun appelant ne propage `pricingExceptions` aujourd'hui) — donc pas de nouvelle fonction "publique" à créer : `getCommercialPublicOffers()` **existe déjà** et ne retourne que `offers` (jamais `pricingExceptions`). Ce qui manquait était la **garantie testée** que cela reste vrai.

## 1ter.4 — test par source, ajouté, branché en CI (via la suite Jest existante)

`__tests__/campaigns/pre-rentree-2026-commercial-contract.test.ts` — nouveau test `getCommercialPublicOffers() never carries a key outside the public allowlist` :
- Liste blanche explicite des clés attendues (`offerId`, `pricingId`, `price`, `deposit`, …).
- Échoue si une clé non listée apparaît sur un objet réellement retourné à l'exécution (pas seulement par le type TypeScript, qui n'empêche pas un `{...spread}` accidentel à l'exécution).
- Ceinture et bretelles : recherche textuelle des champs internes connus (`justification`, `approvedByRole`, `exceptionId`, `editionId`, `standardFloorPerStudentHour`) sur la sortie sérialisée — doit être absente.

**Ce test couvre les tableaux**, contrairement à `--rendered` : `getCommercialPublicOffers()` retourne un tableau d'objets, et le test itère sur chaque entrée — il aurait détecté un `pricingExceptions` (lui-même un tableau) s'il avait été propagé par erreur.

```
$ npx jest __tests__/campaigns/pre-rentree-2026-commercial-contract.test.ts
✓ keeps every public amount derived from canonical pricing
✓ records the approved 3e exception without weakening the global college floor
✓ getCommercialPublicOffers() never carries a key outside the public allowlist
✓ publishes only level-appropriate subjects and approved benefits
✓ keeps unresolved benefits in the decisions registry instead of public offers
Tests: 5 passed, 5 total
```

Déjà branché en CI (fait partie de la suite Jest standard, `npm test`, exécutée à chaque push) — **bloquant**, comme demandé par 1ter.4, à la différence de l'auditeur généralisé.

## Bilan des deux fuites confirmées et de la généralisation

| Source | Fuite | Statut |
|---|---|---|
| `getCarte()` | `rationale` | Corrigée (`getPublicCarte()`), testée |
| `getStageCalendar()` | `pack_product_ids` | Corrigée (`getPublicStageCalendar()`), testée |
| `compileCommercialPublicationContract()` | `pricingExceptions`/`justification` | Pas une fuite active — risque structurel fermé par un test bloquant |
| `getPreRentreeCampaign()` | — | Déjà sûr (server-only + reconstruction) |
| `getPreRentreePublicSurfaceDTO()` | — | Déjà sûr (reconstruction déjà existante) |
| `publication-decisions.owner.json` | — | Pas encore lu ; sera construit sûr dès l'origine (Décision 5) |
