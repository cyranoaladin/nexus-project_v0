# Pré-rentrée 2026 — audit final v5 canonique

## Date

19 juillet 2026

## Contexte

La v4 contenait plusieurs sources de vérité, des programmes divergents, des affirmations commerciales non approuvées et un dossier famille incompatible avec le statut de pré-inscription. La v5 a été reconstruite depuis le SHA `a1192c8dccf8eaa6ae223265a3bc9ceb56a6fff0`, sans scraper le site, sans modifier la production, sans écraser la v4 et sans push.

## Problèmes observés

- 485 affirmations v4 inventoriées, 308 écarts et 27 écarts critiques.
- Programmes PDF non alignés sur les 12 modules et 60 séances canoniques.
- Formulations « Réserver », « Acompte (30 %) », comparaison marché, avantages annuels et enregistrement filmé sans base approuvée.
- Pipeline Essentiel séparé et valeurs métier intégrées au générateur v4.
- Source de conditions particulières juridiquement approuvées absente.

## Décisions prises

1. Compiler un snapshot validé depuis campagne, modules, pricing, `lib/legal.ts`, contact et assets canoniques.
2. Générer six PDF publics et six HTML accessibles avec un seul orchestrateur snapshot-only.
3. Bloquer entièrement les deux PDF privés tant que les conditions et la notice de confidentialité ne sont pas approuvées.
4. Conserver une structure privée non publiable pour préparer le workflow sans inventer de texte juridique.
5. Rendre les builds déterministes et produire les checksums, rasters 200 DPI, planches de contact et audits de contrat.

## Résultats

- `REPO_SHA=a1192c8dccf8eaa6ae223265a3bc9ceb56a6fff0`.
- Campaign `1.0.0`, SHA-256 `ddaee64cfd3231491597c40b514b6d52ee41529d1056d635087796176535ea5d`.
- Modules `2026-pre-rentree-v1`, SHA-256 `891e75b032ad035d22a3f2569d78d707ca56f4a73c3465ee5aeab589466f541e`.
- Pricing `2026-2027.2`, SHA-256 `2581c06f0781b3642c40c36bf9da0582ce63ed7f95ca9ef02756350281af46c4`.
- Legal/contact SHA-256 `9088ae498e82282709226a39f1195bec161487290aa46c4a572d8b7d0d4735fd`.
- Snapshot SHA-256 `891f5b330b428bab783902e72c0186909f49c99a0836458609afcdd22754fef4`.
- Générateur SHA-256 `638508152f897ae769b137e2186b563efaa12056c58401ccd939e545d2cf4502`.
- Deux builds de 109 fichiers identiques; inventaire SHA-256 `c5b32cf7c4989025a9d82d4664a105e7897658da9b89a6be5c5e8fdf70665527`.
- 12 modules, 60 séances, 33 pages PDF; tous les gates publics demandés sont à zéro.

## Tarifs canoniques

| Matières | Prix | Acompte | Solde | TND/h |
|---:|---:|---:|---:|---:|
| 1 | 480 | 140 | 340 | 48 |
| 2 | 900 | 270 | 630 | 45 |
| 3 | 1 350 | 410 | 940 | 45 |
| 4 | 1 800 | 540 | 1 260 | 45 |

## Artefacts principaux

- `outputs-v5-canonical/PUBLIC/` : six PDF, six HTML et visuels sociaux.
- `outputs-v5-canonical/PRIVATE/publication-blocked.json` : preuve du blocage juridique.
- `outputs-v5-canonical/SOURCES/` : snapshot, schéma, générateur, CSS, HTML et tests.
- `outputs-v5-canonical/AUDIT/` : matrice d’affirmations, diff v4, audits contenu/PDF/visuel/accessibilité et manifest.

## Fichiers modifiés

- `scripts/pre-rentree/publication-*.ts` et schéma JSON.
- `scripts/pre-rentree/document_*.py`, `generate_documents.py`, CSS et environnement verrouillé.
- Tests TypeScript/Python, snapshot généré et documentation d’audit.

## Vérifications exécutées

- [x] `python -m pytest scripts/pre-rentree/tests -q` — 34 tests réussis sur l’état final.
- [x] Tests TypeScript ciblés — 4 suites, 45 tests.
- [x] `npm run typecheck`.
- [x] `git diff --check`.
- [x] `python -m py_compile scripts/pre-rentree/*.py`.
- [x] Deux builds complets identiques octet par octet.
- [x] Revue visuelle manuelle des 33 pages et trois visuels sociaux.

## Points de vigilance

- `docs/legal/pre-rentree-2026-commercial-terms-gap-analysis.md` est absent du SHA canonique.
- `TERMS_VERSION`, `EFFECTIVE_DATE`, `OWNER_APPROVAL_REFERENCE` et `LEGAL_APPROVAL_REFERENCE` sont absents.
- La notice de confidentialité n’est pas complète et approuvée.
- Les rapports humains post-build ne font pas partie des 109 fichiers de l’inventaire reproductible.

## Recommandation suivante

- Statut public : `PDF_PACKAGE_READY_FOR_OWNER_REVIEW`.
- Statut privé : `BLOCKED_BY_LEGAL_TERMS`.
- Obtenir les validations juridique/confidentialité, recompiler le snapshot, puis générer et auditer le dossier privé dans un cycle séparé. Ne pas déclarer le pack complet prêt à diffuser avant cette étape.
