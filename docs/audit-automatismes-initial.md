# Audit initial — Module Automatismes Épreuve Anticipée

Date : 2026-04-25
Auditeur : Opus 4.7

## 1. Fichiers inspectés

| Fichier | État |
|---------|------|
| package.json | ✅ Next.js 15.5, React 18.3, Prisma 6.13, TypeScript strict, Jest, Playwright, katex |
| prisma/schema.prisma | ✅ Model `Assessment` complet (answers Json, scoringResult Json, assessmentVersion, engineVersion, globalScore, confidenceIndex, domainScores, skillScores...) |
| app/dashboard/eleve/page.tsx | ✅ Intègre déjà `<AutomatismesDashboardCard grade={...} />` (l. 299) |
| app/api/student/dashboard/route.ts | ✅ Existe, retourne trackContent + student metadata |
| lib/prisma.ts | ✅ Singleton standard |
| auth.ts | ✅ Next-Auth v5 beta, rôle ELEVE |
| components/ui/* | ✅ shadcn/ui (Card, Button, Progress, Badge, Tabs...) |
| app/api/student/automatismes/series/route.ts | ✅ GET liste sans auth, metadata only |
| app/api/student/automatismes/series/[id]/route.ts | ✅ GET détail safe (strip réponses), sans auth |
| app/api/student/automatismes/attempts/route.ts | ✅ GET (history) + POST (submit), avec auth ELEVE |
| app/api/student/automatismes/attempts/[id]/route.ts | ✅ GET détail avec vérification ownership |
| types/automatismes.ts | ✅ Types complets (domaines, questions, séries, résultats) |
| data/automatismes/premiere-eds/simulations.ts | ✅ 10 simulations × 12 questions = 120 questions (123 KB) |
| lib/automatismes/scoring.ts | ✅ Fonction `calculateAutomatismeScore` basique |
| components/automatismes/* | ✅ 4 composants (DashboardCard, List, Player, Results) |
| app/dashboard/eleve/automatismes/page.tsx | ✅ Page avec 3 vues (list / playing / result) |

## 2. Documents pédagogiques trouvés

- `Programme de mathématiques de première générale-248133.pdf` (484 KB)
- `QCM 2025_3adlane°-.pdf` (17 MB)
- `annexe-automatismes-valuables-lors-de-l-preuve-anticip-e-de-math-matiques-pour-l-ann-e-scolaire-2025-2026-au-titre-de-la-session-2027-des-baccalaur-ats-g-n-ral-et-technologique-440631.pdf` (150 KB)
- `declic1S_2026_sujets.pdf` (933 KB)
- `sujet-specialite-1pdf-112050.pdf` (274 KB)
- `sujet-specialite-2pdf-112053.pdf` (393 KB)

## 3. Risques identifiés (gaps critiques)

| # | Risque | Sévérité |
|---|--------|----------|
| 1 | **Player fuite réponses** : la classe CSS `bg-emerald-500` sur `correctChoiceId` est appliquée dès la sélection, avant validation (`showFeedback` jamais activé). L'élève voit la bonne réponse sans valider. | 🔴 CRITIQUE |
| 2 | **Pas de route check-answer** : pas de feedback immédiat par question côté serveur. Mode actuel = simulation sans feedback intermédiaire. | 🟠 MAJEUR |
| 3 | **Scoring manque corrections détaillées** : `AutomatismeAttemptResult` attend `corrections[]` mais `scoring.ts` ne les retourne pas. | 🟠 MAJEUR |
| 4 | **Seuils recommandations erronés** : actuellement sur pourcentage (90/70/50) au lieu de score brut (< 6, 6-8, 9-10, >= 11). | 🟡 MODÉRÉ |
| 5 | **Aucun test unitaire** : pas de `scoring.test.ts`, pas de `simulations.validation.test.ts`. | 🟠 MAJEUR |
| 6 | **API routes sans typecheck auth** : `session: any` dans toutes les routes. | 🟡 MODÉRÉ |
| 7 | **Pas d'E2E** : pas de `e2e/student-automatismes.spec.ts`. | 🟡 MODÉRÉ |
| 8 | **sourceReference/sourceComment** : 120 questions à auditer individuellement (trop volumineux pour un audit rapide). | 🟡 MODÉRÉ |

## 4. Plan d'intégration retenu

### Phase 2 — Corrections critiques
1. Corriger `AutomatismesPlayer.tsx` : masquer la réponse correcte avant validation.
2. Corriger `scoring.ts` : ajouter `corrections[]` au résultat.
3. Corriger les seuils de recommandation sur score brut.

### Phase 3 — Route check-answer
1. Créer `app/api/student/automatismes/check-answer/route.ts` (POST sécurisé).
2. Adapter le player pour appeler check-answer et afficher le feedback.

### Phase 4 — Tests
1. `lib/automatismes/scoring.test.ts` — 10 assertions critiques.
2. `lib/automatismes/simulations.validation.test.ts` — validation matrice Q1-Q12.
3. `e2e/student-automatismes.spec.ts` ou `docs/test-manuel-automatismes.md`.

### Phase 5 — Documentation
1. `docs/automatismes-eds-premiere.md` — fonctionnel complet.
2. `docs/audit-automatismes-final.md` — rapport final.

### Phase 6 — Validation
- `npm run typecheck`
- `npm run build`
- `npx jest lib/automatismes/`
