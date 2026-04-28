# TECH DEBT REGISTER - 2026-04-29

## Classification Rules
- **Bloquant go-live**: Must be fixed before any go-live
- **Avant go-live complet**: Should be fixed before complete go-live (not blocking initial)
- **Post go-live**: Can be fixed after initial go-live
- **Faux positif**: Not actual debt, documentation or context

## TODO/FIXME/HACK Entries

### 1. Analytics backend (app/api/analytics/event/route.ts:8)
```
* TODO: Wire to a real analytics backend (PostHog, Plausible, or DB table).
```
**Classification:** Post go-live
**Justification:** Analytics is not critical for core functionality, can be added later
**Action planned:** Post-go-live, integrate PostHog or similar

### 2. ClicToPay integration (app/api/payments/clictopay/webhook/route.ts:15, init/route.ts:25)
```
// TODO: Implémenter le traitement du webhook ClicToPay
// TODO: Implémenter l'intégration ClicToPay une fois les clés API activées
```
**Classification:** Post go-live
**Justification:** ClicToPay is optional payment method, Konnect is primary
**Action planned:** Post-go-live, when ClicToPay keys are activated

### 3. Payment notification email (app/api/payments/validate/route.ts:382)
```
// TODO: Envoyer email d'information au client
```
**Classification:** Post go-live
**Justification:** Email notification is nice-to-have, not blocking
**Action planned:** Post-go-live, add email notification

### 4. Student activation email (app/api/assistant/activate-student/route.ts:87)
```
// TODO: Send activation email to student
```
**Classification:** Post go-live
**Justification:** Activation email is nice-to-have, manual activation works
**Action planned:** Post-go-live, add activation email

### 5. Bilan gratuit welcome email (app/api/bilan-gratuit/route.ts:117-118)
```
// TODO: Envoyer email de bienvenue
// TODO: Créer une tâche pour l'assistante (nouveau bilan à traiter)
```
**Classification:** Post go-live
**Justification:** Welcome email and task creation are nice-to-have
**Action planned:** Post-go-live, add email and task creation

### 6. Video session credits (app/api/sessions/video/route.ts:95)
```
// TODO: Logique de crédits si nécessaire
```
**Classification:** Post go-live
**Justification:** Credits logic not currently needed, can be added later
**Action planned:** Post-go-live, if credits are implemented

### 7. User isActive field (app/api/admin/users/route.ts:50)
```
// TODO: Add isActive field to User model if needed
```
**Classification:** Faux positif
**Justification:** Comment indicates "if needed", not a requirement
**Action planned:** None, remove comment if not needed

### 8. Assessment recommendations (app/api/assessments/[id]/status/route.ts:55)
```
recommendations: [], // TODO: Extract from analysisJson
```
**Classification:** Post go-live
**Justification:** Recommendations are not critical for status endpoint
**Action planned:** Post-go-live, extract from analysisJson

### 9. Bilan PDF generation (app/api/bilans/[id]/export/route.ts:172)
```
// TODO: Trigger async PDF generation here
```
**Classification:** Post go-live
**Justification:** Current PDF generation works, async is optimization
**Action planned:** Post-go-live, implement async generation

### 10. Hero section modal (components/sections/hero-section.tsx:192)
```
// TODO: Ouvrir modale bilan gratuit directement
```
**Classification:** Post go-live
**Justification:** UX improvement, not blocking
**Action planned:** Post-go-live, add modal

### 11. ARIA rights check (components/ui/aria-chat.tsx:51)
```
// TODO: Vérifier les droits ARIA de l'élève
```
**Classification:** Avant go-live complet
**Justification:** ARIA rights check is important for security and UX
**Action planned:** Before go-live complete, implement rights check

### 12. NSI questions migration (lib/assessments/questions/nsi/**/*.ts)
```
* TODO: Créer questions Première
* TODO: Migrer les 3 questions depuis stage-qcm-structure.ts
* TODO: Migrer les 4 questions depuis stage-qcm-structure.ts
```
**Classification:** Post go-live
**Justification:** NSI questions are not blocking for Maths Première go-live
**Action planned:** Post-go-live, migrate NSI questions

### 13. QCM bank additional questions (lib/survival/qcm-bank.ts:385)
```
// TODO: Shark fournira 30 questions simulées additionnelles dans une seconde itération.
```
**Classification:** Post go-live
**Justification:** Additional questions are nice-to-have
**Action planned:** Post-go-live, when questions are provided

### 14. Theme colors migration (lib/theme/tokens.ts:79)
```
// TODO: Migrate to neutral/surface colors
```
**Classification:** Post go-live
**Justification:** Theme migration is not blocking
**Action planned:** Post-go-live, migrate to neutral/surface colors

### 15. Mixed payments normalization (lib/invoice/nexus-calculations.ts:186)
```
// TODO: Normalize mixed payments into a dedicated table when the invoice schema evolves.
```
**Classification:** Post go-live
**Justification:** Current mixed payments work in invoice.notes, dedicated table is optimization
**Action planned:** Post-go-live, when schema evolves

### 16. RAG references tracking (lib/dashboard/student-payload.ts:208, 346)
```
*   - RAG_REFERENCE → currently empty (TODO: requires schema extension to track
// TODO (post Lot B): surface RAG sources consulted during ARIA conversations.
```
**Classification:** Post go-live
**Justification:** RAG references are nice-to-have, not blocking
**Action planned:** Post-go-live (Lot B), extend schema

## Legacy References

### 1. Legacy embedding column (schema.prisma)
**Classification:** Post go-live
**Justification:** Legacy column not used, can be removed later
**Action planned:** Post-go-live, remove from schema

### 2. Legacy scoring systems (lib/bilan-scoring.ts)
**Classification:** Post go-live
**Justification:** Legacy scoring still works, migration can be done later
**Action planned:** Post-go-live, migrate to V2

### 3. Legacy stage février 2026
**Classification:** Post go-live
**Justification:** Legacy stage still functional, can be deprecated later
**Action planned:** Post-go-live, deprecate and migrate to new stage

## Deprecated Items

### 1. Deprecated colors (lib/theme/tokens.ts)
**Classification:** Post go-live
**Justification:** Deprecated colors still work, migration is cleanup
**Action planned:** Post-go-live, migrate to new colors

## Summary

**Bloquant go-live:** 0
**Avant go-live complet:** 1 (ARIA rights check)
**Post go-live:** 16
**Faux positif:** 1

**Decision:** No blocking TODOs. ARIA rights check should be fixed before go-live complete. All other TODOs can be addressed post-go-live.

**Go-live ready from TODO perspective.**
