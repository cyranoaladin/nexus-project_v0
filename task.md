# Tâches — Refonte des Dashboards Nexus V2

## Phase 5 — Dashboard Parent (Famille & Détail)
- [x] Vue Famille consolidée (`app/dashboard/parent/page.tsx`)
- [x] Page Détail Enfant (`app/dashboard/parent/enfant/[studentId]/page.tsx`)
- [x] Graphique d'évolution (`ProgressEvolutionChart.tsx`)
- [x] Alertes Consolidées (`AlertsConsolidated.tsx`)

## Phase 6 — Dashboard Coach (Pilotage & Trajectoire)
- [x] Vue Cohorte Stratégique (`app/dashboard/coach/page.tsx`)
- [x] Page Détail Élève Coach (`app/dashboard/coach/eleve/[studentId]/page.tsx`)
- [x] Composant Trajectory Designer (`TrajectoryDesigner.tsx`)
- [x] API Trajectoire (`app/api/coach/trajectory/route.ts`)

## Phase 7 — Hygiène & UI
- [x] Nettoyage des couleurs hardcodées (Migration tokens)
- [x] Alignement 100% sur `lib/theme/tokens.ts`
- [x] Responsive Check (Tablettes & Mobiles)
- [x] Optimisation de l'API Dashboard Élève (Track-aware)

## Phase 8 — E2E & Go-Live
- [x] Écriture des tests E2E Playwright (`e2e/dashboards-v2-refonte.spec.ts`)
- [ ] Exécution des tests E2E (Nécessite DB locale stable)
- [ ] Push Final sur `main`
- [ ] Vérification Serveur de Production
