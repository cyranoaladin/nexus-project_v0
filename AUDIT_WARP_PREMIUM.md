# AUDIT_WARP_PREMIUM.md

Horodatage: 2025-08-30T17:20:42Z

## 0) Executive summary

- Forces: À compléter après exécution des preuves (SSE, RAG, PDF, crédits, paiements cash, CI/CD).
- Risques/dettes: À jour des correctifs (SSE cleanup, offres dynamiques, RAG_STORAGE_DIR). Points restants: UI ingestion multi-formats, prompt bilans premium final.
- Plan priorisé: 1) UI ingestion RAG + RBAC + idempotence; 2) Orchestrateur Bilans premium; 3) Couverture tests; 4) Runbooks; 5) CI budgets perf.

## 1) Feuille de route priorisée (Impact × Effort)

- Critique (R): RAG dashboard complet (upload multi-formats + logs + recherche UI); Bilans premium (prompt + PDF); RBAC exhaustif.
- Majeur (Y): Tests E2E supplémentaires, monitoring/alerting, coûts OpenAI.
- Mineur (G): Améliorations UI/UX, documentation enrichie.

## 2) Parité Dev ↔ Prod

| Element | Dev | Prod |
| --- | --- | --- |
| ARIA mode | DIRECT_OPENAI_DEV=1 (clé réelle) | USE_LLM_SERVICE=1 (ou direct) |
| PDF Bilans | OpenAI gpt-latest | gpt-4o (ou équivalent) |
| RAG storage | RAG_STORAGE_DIR=/var/lib/nexus/rag | idem (monté, backup) |
| SSE Pricing | cleanup OK | idem |
| Auth | NextAuth JWT | NextAuth JWT (HTTPS, HSTS) |

## 3) Checklist conformité

- Sécurité: CSP/HSTS prod; cookies Secure/HttpOnly; secret scanning: OK/À compléter.
- RGPD: PII minimisées, pages légales versionnées; à valider export/suppression.
- A11y: axe-core sur pages critiques (pending).
- Perf: SSE P95, ingestion 5–20MB (à mesurer); budgets à fixer.
- Coûts: estimer tokens OpenAI (à fournir dans annexes).

## 4) Tableau endpoints (aperçu)

```json
{
  "endpoints": []
}
```

## 5) ERD Prisma (texte)

- Principaux modèles: User, Student, Bilan, PedagogicalContent, KnowledgeAsset, CreditWallet/Tx, Pricing, OfferBinding, PaymentRecord/Settings, BillingPolicy, AuditLog.

## 6) Data-flow ARIA ↔ RAG ↔ PDF ↔ DB

- ARIA (chat SSE) -> OpenAI -> logs sanitizés -> (option) mémoire long-terme.
- RAG upload -> storage (RAG_STORAGE_DIR / MinIO) -> embeddings -> KnowledgeAsset.
- Bilans -> OpenAI -> LaTeX/React-PDF -> PDF -> stockage DB Blob.

## 7) Matrices de tests

```json
{
  "unit": [
    "texEscape truth table (# $ % _ { } ^ ~ \\ &) + truncation",
    "mapPremiumToTexView: radar axis order (NSI/Maths), timeline mapping C/D/T ↔ S1..S8",
    "recommendOffer overlay: 69/70% boundaries, low domains <50%, candidat_libre",
    "Stub safety: stubs inactive when NODE_ENV=production"
  ],
  "integration": [],
  "e2e": [
    "bilan.premium.spec.ts — JSON + PDF parent/élève with pdfinfo gates",
    "rag.ingestion.docx.ocr.spec.ts — upload DOCX/OCR + search provider=stub"
  ]
}
```

### 7.1 Envs (stub vs real)

- Stub (blocking CI):
  - E2E=1, NODE_ENV!='production'
  - PDF_RENDERER_FORCE=react, STORAGE_PROVIDER=file, RAG_OCR_ENABLED=1
- Real (allow_failure CI):
  - Postgres service, DATABASE_URL set
  - PDF renderer auto (LaTeX fallback), OCR optional

### 7.2 PDF Gates (stub)

- Parent: size ≥ 120KB, pages ≥ 3 (served from public/files/bilan-parent-stub.pdf in E2E)
- Élève: size ≥ 70KB, pages ≥ 2 (served from public/files/bilan-eleve-stub.pdf in E2E)

### 7.2.1 pdfinfo outputs (stub fixtures)

Parent (bilan-parent-stub.pdf) and Élève (bilan-eleve-stub.pdf) as generated:

- See CI job summary for live outputs from `pdfinfo public/files/bilan-parent-stub.pdf` and `pdfinfo public/files/bilan-eleve-stub.pdf`.

### 7.3 Artefacts CI à publier (stub)

- Playwright HTML report, traces zip (test-results)
- JUnit: junit-e2e.xml
- pdfinfo (parent/élève) attachés aux tests (Playwright attachments)

## 8) Runbooks incidents

- OpenAI down, RAG corrompu, Emails down, DB failover, rotation clés.

## 9) Chiffrages

- À estimer par lot (RAG UI, Bilans premium, E2E, monitoring).

## Annexes

- env_inventory.json, endpoints.json, test_matrices.json, patches/.diff

