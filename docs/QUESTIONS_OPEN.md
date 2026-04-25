# QUESTIONS_OPEN

Ce document liste les questions bloquantes nécessitant une décision de Shark.

| Question | Contexte | Statut | Décision |
|---|---|---|---|
| Barème exact Maths STMG (pondération domaines, seuils Bloom) | Phase 2 | Ouvert | - |
| Contenus pédagogiques STMG (exercices, corrigés, vidéos) | Phase 2/4 | Ouvert | Voir `docs/STMG_CONTENT_ROADMAP.md` |
| Rotation des mots de passe seed `admin123` avant go-live public | Go-live | Ouvert | - |
| Tag `v1.0.0-dashboards-premiere` (exige confirmation explicite) | Phase 8 | En attente | - |

---

## Phase 7 — violations charte graphique restantes (hors scope refonte)

Audit du 25/04/2026 : les composants nouveaux de la refonte
(`components/dashboard/{eleve,parent,coach}/`, sous-routes `programme/maths`,
`enfant/[studentId]`, `eleve/[studentId]`) sont **100 % propres** vis-à-vis
de la règle "no `bg-[#...]` / no `style={{ background... }}` couleur littérale".

7 violations subsistent sur des écrans **hors scope** de la refonte. À traiter
dans un lot dédié (Phase 7.b) si Shark valide la priorisation :

| Fichier | Ligne | Pattern |
|---|---|---|
| `app/dashboard/assistante/stages/planning/page.tsx` | 234 | `bg-[#0d1117]` |
| `app/stages/_components/NexusStagesPage.tsx` | 987, 1031 | `bg-[#111826]` (×2) |
| `app/stages/_components/StickyMobileCTA.tsx` | 29 | `bg-[#0f172acc]` |
| `app/programme/maths-terminale/components/MathsTerminaleClient.tsx` | 166–167 | gradient `from-[#...] via-[#...] to-[#...]` + `bg-[#060b1a]/90` |
| `components/sections/hero-section-gsap.tsx` | 183 | gradient `from-[#0a0b0f]` |

Les `style={{ backgroundColor: "rgb(var(--color-surface-card))" }}` dans les pages
`auth/*` utilisent déjà une CSS variable (cohérent avec le design system même si
non passé par `tokens.ts`) — non bloquant. Les `style={{ backgroundColor: ... }}`
data-driven (`InteractiveMafs.tsx:236`, `progress-chart.tsx:103`) sont
légitimes (couleur en runtime).
