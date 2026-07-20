# Pré-rentrée 2026 — chaîne documentaire

## Statut

```text
PUBLIC_DOCUMENT_PACKAGE=READY_FOR_OWNER_REVIEW
OWNER_REVIEW=PENDING
LEGAL_REVIEW=PENDING
PRIVACY_REVIEW=PENDING
PRIVATE_CONTRACTUAL_PACKAGE=BLOCKED
MERGE=NOT_PERFORMED
DEPLOYMENT=NOT_PERFORMED
PUBLIC_DISTRIBUTION=NOT_AUTHORIZED
```

Le Guide Parents complet est le document principal. Les brochures Essentiel, Planning, Programmes par niveau et Tarifs sont des annexes produites par le même renderer.

## Sources et architecture

- campagne : `data/campaigns/pre-rentree-2026.json` ;
- programmes : `content/pre-rentree-2026/modules.json` ;
- tarifs : `data/pricing.canonical.json` ;
- identité et contact : `lib/legal.ts` ;
- contenu éditorial : `content/pre-rentree-2026/parent-guide.fr.json` ;
- compilateur et renderer uniques : `scripts/pre-rentree/` ;
- snapshot suivi : `generated/pre-rentree-2026/publication.snapshot.json` ;
- sorties locales ignorées : `.artifacts/pre-rentree-2026/`.

## Commandes

```bash
npm run pre-rentree:snapshot
npm run pre-rentree:build
npm run pre-rentree:audit
npm run pre-rentree:package
npm run pre-rentree:verify
```

Le workflow GitHub Actions téléverse les paquets famille et revue sans publier de release et sans déployer.

## Règles de frontière

Le dépôt étant public, il ne contient aucune sortie prétendument privée. Les lacunes de conformité sont décrites dans [`COMPLIANCE-GAPS.md`](COMPLIANCE-GAPS.md). Aucun dossier de confirmation contractuel n’est produit avant validation juridique et confidentialité.

## Références

- [Carte des sources](SOURCE-OF-TRUTH-MAP.md)
- [Carte du Guide Parents](PARENT-GUIDE-SOURCE-MAP.md)
- [Matrice Parcours 360](PARCOURS360-CAPABILITY-MATRIX.md)
- [Processus de release](RELEASE-PROCESS.md)
- [Checklist propriétaire](OWNER-REVIEW-CHECKLIST.md)
- [Décisions restantes](DECISIONS-REQUIRED.md)
- [Journal des changements](CHANGELOG.md)
