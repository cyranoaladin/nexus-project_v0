# Sécurité de la surface interne candidat-individuel (mission "vers un produit complet" §9)

Revue explicite de chaque point demandé, avec la preuve (test ou lecture de code) plutôt qu'une affirmation.

| Contrôle | Statut | Preuve |
|---|---|---|
| ADMIN autorisé | ✅ | `requireInternalPipelineAccess` appelle `requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE])` — vérifié par un test dédié qui assert l'appel exact, pas seulement le comportement (`__tests__/lib/quotes/candidat-individuel-guard.test.ts`). |
| ASSISTANTE autorisée | ✅ | Même liste, même test. |
| PARENT refusé | ✅ (par construction) | `requireAnyRole` ne reçoit que `[ADMIN, ASSISTANTE]` — un rôle absent de cette liste est refusé par `requireAnyRole` lui-même (couvert exhaustivement par `__tests__/lib/guards.test.ts`/`guards.complete.test.ts`, non dupliqué ici). |
| ELEVE refusé | ✅ (par construction) | Identique. |
| Non authentifié refusé | ✅ | `requireAnyRole` délègue à `requireAuth`, qui renvoie 401/403 avant toute résolution de rôle — testé dans `guards.test.ts`. Le fallback de la page (`app/dashboard/assistante/candidat-individuel/*/page.tsx`) redirige aussi explicitement vers `/auth/signin` côté serveur (vérifié manuellement — un `curl` sans cookie retourne HTTP 307 vers `/auth/signin`). |
| Protection IDOR entre profils | **Constat explicite, pas un bug** | `getProfilCandidat`/`updateProfilCandidat`/`createProfilCandidatRevision` ne filtrent pas par créateur — n'importe quel ADMIN/ASSISTANTE authentifié peut lire/modifier n'importe quel `ProfilCandidat` par id. Ce n'est **pas** un IDOR au sens classique (famille → famille) : c'est le même modèle de visibilité déjà en vigueur pour `searchContactLeads`/`listQuotesForLeadOrStudent` (tout le staff voit tous les leads/devis — un outil de travail partagé, pas un espace personnel par utilisateur). Documenté ici pour que ce choix soit explicite, pas silencieux. |
| Validation Zod | ✅ | Chaque route a un schéma `.strict()` dans `lib/quotes/candidat-individuel-api-schemas.ts` — testé (400 sur corps malformé) dans `__tests__/api/assistante.candidat-individuel.route.test.ts` et `__tests__/database/candidat-individuel-quote-creation.test.ts`. |
| CSRF | ✅ (hérité) | Ces routes sont des Route Handlers Next.js authentifiés par cookie de session `SameSite=Lax` (NextAuth v5, config partagée `auth.ts`) — la même protection CSRF que toutes les routes ADMIN/ASSISTANTE existantes de ce dépôt, non réimplémentée séparément. |
| Rate limiting | ⚠️ **Absent sur ces routes spécifiques** — corrigé | Aucune des routes `app/api/assistante/candidat-individuel/**` n'appelait `guardSensitiveRateLimit` avant cette vérification, contrairement à `/api/quotes` et `/api/quotes/margin`. Corrigé dans ce commit (voir ci-dessous). |
| Aucune mutation du flag depuis la prévisualisation | ✅ | Ni `PublicWizardPreview.tsx` ni `CandidatIndividuelWorkspace.tsx` n'appellent jamais `/api/admin/config` — vérifié par recherche (aucune référence à cette route dans les deux fichiers). |
| Aucun champ staff accepté depuis une entrée publique | ✅ | `candidatIndividuelSimulateBodySchema`/`profilCandidatDraftBodySchema` (schémas utilisés par les routes) n'acceptent que les champs de `PublicCandidateInputRaw` + `staffExtension` optionnel — mais **ces routes sont elles-mêmes staff-only** (ADMIN/ASSISTANTE), donc `staffExtension` y est légitimement acceptable. Le wizard de prévisualisation (`PublicWizardPreview.tsx`), lui, ne construit et n'envoie jamais de `staffExtension` — vérifié par lecture, aucun champ staff n'est collecté dans son état React. |
| Aucune donnée de marge dans le HTML/RSC/API/PDF | ✅ **Corrigé dans ce commit** | Avant cette vérification, `POST .../profils/:id/quote` renvoyait `marginPct` (dans la réponse 422) et l'objet `Quote` complet (incluant `snapshotRegles`, qui contient `costPolicy` et `margin.marginPct`) dans sa réponse 201. Corrigé : la réponse ne porte plus que le `gate` qualitatif (GREEN/WARNING/BLOCKED, déjà le seul niveau d'information exposé par le badge `GATE_BADGE` existant côté `DevisWorkspace.tsx`) et un sous-ensemble sûr du `Quote` (id/status/regulatoryMaturity/profilId/montants — jamais `snapshotCarte`/`snapshotRegles`). Testé explicitement : `expect(body.quote).not.toHaveProperty('snapshotRegles')` + une recherche regex sur la réponse entière (`marginPct|costPolicy|teacherCostPerHourTnd`) dans `__tests__/database/candidat-individuel-quote-creation.test.ts`. |

## Rate limiting — corrigé dans ce commit

Constat : `guardSensitiveRateLimit` est déjà utilisé par `/api/quotes` et `/api/quotes/margin` (both staff/
public sensitive actions), mais aucune route `app/api/assistante/candidat-individuel/**` ne l'appelait avant
cette vérification — un oubli réel, pas un choix documenté. Ajouté à `simulate` et à
`profils/:id/quote` (les deux actions les plus coûteuses — respectivement un calcul complet du moteur et une
écriture transactionnelle), scope `credentials-login`... non, un nouveau scope dédié
`candidat-individuel-staff` a été ajouté (voir `lib/rate-limit/sensitive.ts`), identité = `session.user.id`
(rate-limit par utilisateur staff, pas par IP seule — cohérent avec un usage interne authentifié).
