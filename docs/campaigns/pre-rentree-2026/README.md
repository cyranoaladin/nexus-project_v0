# Pré-rentrée 2026 — candidat public 2.1.0

## Statut

```text
RELEASE_STATUS=SEE data/campaigns/pre-rentree-2026.json
CAMPAIGN_VERSION=2.1.0
PEDAGOGICAL_MODULES=17
PEDAGOGICAL_SESSION_TEMPLATES=85
OPERATIONAL_COHORTS=17
SCHEDULED_SESSION_OCCURRENCES=85
STUDENT_SESSIONS_PER_SUBJECT=5
STUDENT_HOURS_PER_SUBJECT=10
PUBLIC_PDF_COUNT=7
ROOM_ASSIGNMENTS_VALIDATED=false
TEACHER_ASSIGNMENTS_VALIDATED=false
MERGE=SEE PR #79
DEPLOYMENT=SEE FINAL-GO-LIVE-REPORT
PUBLIC_DISTRIBUTION=CONTROLLED_BY_RELEASE_GATE
```

Le candidat comprend cinq niveaux, 17 modules pédagogiques et 85 séances
modèles. Ses 17 cohortes produisent 85 occurrences calendaires, sans augmenter
le volume suivi par un élève : une matière reste composée de cinq séances et
dix heures. La publication est fail-closed tant que les sources canoniques ne
portent pas simultanément `PUBLIC_READY` et toutes les gates résolues.

## Sources

- campagne, planning, CTA et modalités : `data/campaigns/pre-rentree-2026.json` ;
- dix-sept programmes : `content/pre-rentree-2026/modules.json` ;
- corpus pédagogique canonique : `content/pre-rentree-2026/pedagogy/` ;
- prix et acomptes : `data/pricing.canonical.json` ;
- offres Fondations/Premium : `content/pre-rentree-2026/offers.json` ;
- capacités et garde-fous : `content/pre-rentree-2026/capabilities.json` ;
- manuels : `content/pre-rentree-2026/manuals.registry.json` ;
- contenus éditoriaux et communication : `content/pre-rentree-2026/*.fr.json` ;
- identité et contacts publics : `lib/legal.ts` ;
- compilateur, renderer et audits : `scripts/pre-rentree/`.

Les sept PDF publics sont suivis sous
`public/documents/pre-rentree-2026/` et reproduits par un environnement
documentaire épinglé. Les paquets internes de revue, snapshots et rapports
intermédiaires sont générés sous `.artifacts/pre-rentree-2026/` ou comme
artefacts GitHub Actions.

## Commandes

```bash
npm run pre-rentree:clean
npm run pre-rentree:snapshot
npm run pre-rentree:commercial-contract
npm run pre-rentree:test:ts
npm run pre-rentree:test:py
npm run pre-rentree:itinerary-matrix
npm run pre-rentree:public-pdfs
npm run pre-rentree:public-pdfs:verify
npm run pre-rentree:build
npm run pre-rentree:audit
npm run pre-rentree:package
npm run pre-rentree:verify
npm run pre-rentree:ci
```

## Frontière de publication

Le dépôt est public. Aucun dossier contractuel nominatif n’est produit. Les
surfaces publiques n’exposent ni enseignant, ni rôle interne, ni numéro de
salle non validé. Le planning propose un itinéraire structurel sous réserve de
disponibilité ; il ne réserve ni ne bloque une place.

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
- [Corpus pédagogique canonique](pedagogy/README.md)
