# Qualification du finding `internal-token: pre2026-pack-` sur `/stages`

Date : 2026-07-29
Méthode : inspection directe du HTML capturé localement (`--save-html`), contre un serveur `next dev` local — jamais la production. Aucune correction appliquée.

## M1 — qu'est-ce exactement ?

Un objet JSON complet, sérialisé dans la charge utile d'hydratation React (`self.__next_f.push(...)`, mécanisme standard Next.js pour passer des props d'un Server Component à un Client Component), correspondant tel quel à l'entrée `stage_calendar` de `pre-rentree-2026` dans `data/pricing.canonical.json` :

```json
{
  "id": "pre-rentree-2026",
  ...
  "notes": "Produit dédié avec packs 1–4 matières. Ne pas confondre avec les formats intensifs génériques.",
  "pack_product_ids": ["pre2026-pack-1", "pre2026-pack-2", "pre2026-pack-3", "pre2026-pack-4"]
}
```

Ce n'est ni un identifiant technique isolé ni une simple coïncidence de nommage : c'est **l'objet de données interne entier**, y compris un champ `notes` qui est une annotation de maintenance de catalogue (« Ne pas confondre avec les formats intensifs génériques »), clairement écrite pour quiconque maintient `pricing.canonical.json`, pas pour un parent visiteur. Rien de tout cela n'est rendu visible à l'écran — c'est présent dans le HTML servi, extractible via « Afficher la source » ou les outils de développement, mais pas dans le texte qu'un visiteur lit.

**Cause technique** : `app/stages/page.tsx` appelle `getStageCalendar()` puis transmet l'objet complet (non filtré) au composant client `Stages2026Page` via la prop `calendar`. Next.js sérialise alors l'intégralité de chaque entrée de calendrier dans la charge d'hydratation, y compris les champs que l'interface n'affiche jamais (`notes`, `pack_product_ids`).

## M2 — quelle donnée est réellement exposée, depuis quand ?

- **`pack_product_ids`** : les identifiants `pre2026-pack-1..4` eux-mêmes. Vérifié : les **prix** correspondants (480/900/1350/1800 TND) sont **déjà affichés publiquement et visiblement** sur `/offres` et sur `/stages` lui-même (les 4 montants apparaissent en texte visible sur `/offres` ; `TND` et `900` apparaissent en texte visible sur `/stages`). L'identifiant technique n'ajoute donc **aucune information commerciale nouvelle** — le contenu (combien coûte quoi) est déjà public et voulu tel.
- **`notes`** : le texte d'annotation interne lui-même. Ceci n'est affiché nulle part sur le site — sa seule exposition est cette charge d'hydratation.
- **Depuis quand** : non déterminé précisément — le champ `notes`/`pack_product_ids` existe dans `data/pricing.canonical.json` depuis l'introduction des packs pré-rentrée (`b3fd7a5d7`, 2026-07-12, déjà documenté dans le triage RC), et `app/stages/page.tsx` transmet `getStageCalendar()` sans filtrage depuis une date antérieure à cet audit — la fenêtre d'exposition n'a pas été bornée précisément faute d'historique de rendu antérieur à examiner.

## M3 — le feu vert du 26/07 rend-il ceci sans objet ?

**Non.** Preuve : le motif `/pre2026-pack-/i` qui a déclenché ce finding vit dans `internalTokenPatterns` de `final-public-release-audit.mjs` — la liste vérifiée dans **tous les modes**, y compris `--rendered`, distincte de `copiedBusinessFactPatterns` (motifs de prix/dates, eux bien résolus par la publication). Le motif cible spécifiquement la **convention de nommage interne** des identifiants produit, pas le fait que la campagne soit publique ou non. `PUBLIC_READY` répond à « la campagne peut-elle être visible » — pas à « les artefacts de modélisation de données internes (identifiants SKU, notes de maintenance de catalogue) peuvent-ils fuiter dans le HTML servi ». Ce sont deux questions orthogonales : la seconde reste ouverte quel que soit le statut de la première.

## M4 — rien corrigé

Aucune modification de code ni de contenu. Pour mémoire, un correctif technique de ce type de fuite (si le propriétaire le juge nécessaire) consisterait à ne transmettre au composant client que les champs réellement affichés (`title`, `dates_display`, `objective`, `audience`, `subjects`) et à ne jamais transmettre `notes`/`pack_product_ids` — un changement de shape de données, pas de contenu commercial, mais le périmètre de ce qui doit ou non apparaître dans le HTML servi relève du propriétaire, pas de cet audit.
