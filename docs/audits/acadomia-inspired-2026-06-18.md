# Lot Inspiration Acadomia — Nexus Réussite

## Date

2026-06-18

## Contexte

Application des mécaniques marketing validées par le lead sur le front public Nexus Réussite, sans inventer de preuve sociale, sans promesse de résultat, et avec ARIA comme nom unique de plateforme.

## Décisions livrées

| Décision | Statut | Notes |
|---|---:|---|
| D1 Conseiller + rappel 24 h | OK | Carte conseiller pilotée par `content/team.json`, fallback non nominatif, formulaire rappel via `/api/contact`. |
| D2 Process 4 étapes | OK | Bloc réutilisable `ProcessSteps` avec copie validée et mention réponse sous 24 h ouvrées. |
| D3 Réassurance risk-reversal | OK | `ReassuranceChips` ajouté sur accueil et offres. |
| D4 Transparence tarifaire | OK | `TransparencyBanner` ajouté sur accueil/offres. |
| D5 Enjeux par niveau | OK | `EnjeuxNiveau` ajouté sur accueil et accompagnement scolaire. |
| D6 Bouquet inclus + Carte Nexus | OK | `AccompagnementInclus` ajouté sur accueil/offres, Carte Nexus remontée dans la narration offres. |
| D7 Preuve sociale vérifiable | OK | `Testimonials` masqué si `content/social-proof.json` est vide, aucun avis inventé. |
| D8 Newsletter + ressources | OK | `/api/newsletter`, `NewsletterSignup`, `/ressources` avec empty-state. |
| D9 Landing SEO | OK | 4 pages créées : bac français Tunis, EAF, Grand Oral, candidat libre. |
| D10 Contact segmenté | OK | Onglets d’intention, consentement RGPD, rappel 24 h, soumission `/api/contact`. |
| D11 Intensifs saisonnalisés | OK | 6 éditions canoniques, Noël inclus, repères tarifs et Pass Intensifs Année. |

## Sécurité et preuve sociale

- `content/social-proof.json` et `content/team.json` sont vides par défaut.
- Aucune note, avis, taux de réussite ou identité de conseiller n’est inventé.
- Les formulaires newsletter/contact/rappel exigent un consentement pour les usages correspondants.
- Les anciens libellés “Masterium” ont été remplacés par ARIA dans le code applicatif et les archives statiques servies.

## Pricing

- Les pages nouvelles et modifiées lisent les prix via `lib/pricing.ts`.
- `data/pricing.canonical.json` a été réaccentué et renommé côté plateforme en ARIA sans changement volontaire de montants.
- Les remises Pass sont arrondies à l’affichage, sans modifier les valeurs canoniques.

## Tests exécutés

| Commande | Résultat | Commentaire |
|---|---:|---|
| `git diff --check` | OK | Aucun whitespace error. |
| `npm run lint` | OK | Warnings existants, pas d’erreur. |
| `npm run typecheck` | OK | 0 erreur TypeScript. |
| `npm run test -- --runInBand` | OK | 482 suites, 6128 tests, 7 snapshots. |
| `npm run build` | OK | Build Next.js et copie standalone OK. |
| `npx playwright test e2e/public-front-go-live.spec.ts` | OK | 22 tests Chromium passés. |

## Scans de non-régression

| Scan | Résultat | Commentaire |
|---|---:|---|
| `rg "Masterium|masterium|MASTERIUM" app components lib data public content` | OK | 0 occurrence. |
| Tokens non accentués dans `pricing.canonical.json` | OK | 0 occurrence. |
| Claims commerciaux critiques | OK | 0 occurrence pour les motifs bloquants scannés. |

## Points explicitement non exécutés

- Lighthouse mobile n’a pas été exécuté dans ce lot.
- Aucun déploiement production n’a été effectué.

## Rollback

Revenir au commit précédent ou réinitialiser la branche de travail avant merge. Les changements sont isolés sur la branche `feat/acadomia-inspired`.

## Risques restants

- Les anciens composants marketing hors surfaces principales restent nombreux dans le dépôt ; les claims critiques détectés ont été neutralisés, mais une consolidation design/composants reste recommandée.
- Les routes anciennes `/academies-hiver`, `/stages/fevrier-2026` et pages dashboard n’ont pas fait l’objet d’un audit UX complet dans ce lot.
