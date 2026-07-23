# Pré-rentrée 2026 — release candidate de revue

## Statut

```text
PUBLIC_DOCUMENT_PACKAGE=READY_FOR_OWNER_REVIEW
OWNER_REVIEW=PENDING
LEGAL_REVIEW=PENDING
PRIVACY_REVIEW=PENDING
PRIVATE_CONTRACTUAL_PACKAGE=BLOCKED
ROOM_ASSIGNMENTS_VALIDATED=false
TEACHER_ASSIGNMENTS_VALIDATED=false
MERGE=NOT_PERFORMED
DEPLOYMENT=NOT_PERFORMED
PUBLIC_DISTRIBUTION=NOT_AUTHORIZED
```

La campagne en mode `REVIEW` comprend quatre niveaux, seize modules et quatre-vingts séances. Le Guide Parents est le document principal ; les documents courts et les programmes de niveau sont des annexes issues du même snapshot.

## Sources

- campagne, planning, CTA et modalités : `data/campaigns/pre-rentree-2026.json` ;
- quatorze programmes : `content/pre-rentree-2026/modules.json` ;
- prix et acomptes : `data/pricing.canonical.json` ;
- offres Fondations/Premium : `content/pre-rentree-2026/offers.json` ;
- capacités et garde-fous : `content/pre-rentree-2026/capabilities.json` ;
- manuels : `content/pre-rentree-2026/manuals.registry.json` ;
- contenus éditoriaux et communication : `content/pre-rentree-2026/*.fr.json` ;
- identité et contacts publics : `lib/legal.ts` ;
- compilateur, renderer et audits : `scripts/pre-rentree/`.

Aucun dérivé documentaire n’est suivi. Le snapshot, les PDF, HTML, images, kits, tests pédagogiques matérialisés, formulaires de revue, CSV, XLSX et ZIP sont générés sous `.artifacts/pre-rentree-2026/` ou comme artefacts GitHub Actions.

## Commandes

```bash
npm run pre-rentree:clean
npm run pre-rentree:snapshot
npm run pre-rentree:test:ts
npm run pre-rentree:test:py
npm run pre-rentree:build
npm run pre-rentree:audit
npm run pre-rentree:package
npm run pre-rentree:verify
npm run pre-rentree:ci
```

## Frontière de publication

Le dépôt est public. Les gabarits d’inscription et le CRM sont anonymes, marqués pour revue et uniquement présents dans l’artefact propriétaire. Aucun dossier contractuel nominatif n’est produit. Le planning familial porte un avertissement tant que salles et enseignants ne sont pas affectés et validés. Les manuels ne sont pas annoncés tant que les quatre gates d’impression, d’approbation et de stock ne sont pas satisfaits.

## Navigation

- [Carte des sources](SOURCE-OF-TRUTH-MAP.md)
- [Carte du Guide Parents](PARENT-GUIDE-SOURCE-MAP.md)
- [Matrice Parcours 360](PARCOURS360-CAPABILITY-MATRIX.md)
- [Matrice de preuves](VALUE-PROOF-MATRIX.md)
- [Matrice d’affectation](STAFFING-MATRIX.md)
- [Lacunes de conformité](COMPLIANCE-GAPS.md)
- [Processus de release](RELEASE-PROCESS.md)
- [Checklist propriétaire](OWNER-REVIEW-CHECKLIST.md)
- [Décisions restantes](DECISIONS-REQUIRED.md)
- [Journal des changements](CHANGELOG.md)
