# QA release candidate — Pré-rentrée 2026

## Identité

- PR : #74
- Branche : `feat/svt-integration-clean`
- SHA source inventorié : `b106a89ac523b35c88ffe62cb0db246012bf5778`
- Date : 23 juillet 2026
- Statut maximal actuel : `READY_FOR_REVIEW`
- Verdict : `BLOCKED`

## Contrôles acquis

| Contrôle | Résultat |
|---|---:|
| Fondations maximum 6 / Premium maximum 5 | ✅ |
| Aucune SNT ou initiation informatique en Seconde | ✅ |
| NSI en Première et Terminale | ✅ |
| 15 modules × 5 séances = 75 séances | ✅ |
| Acompte + solde = prix canonique | ✅ |
| Modules Maths marqués PROPOSITION | ✅ |
| Programmes SVT filigranés DRAFT | ✅ |
| Formulation enseignants prudente | ✅ |
| Positionnement/bilan parent non validés masqués | ✅ |
| Calendrier J1…J29 sans date inventée | ✅ |
| 3 grilles dans le HTML initial | ✅ |
| Planning JSON ↔ PDF | ✅ |
| PDF rasterisés et planche contact inspectée | ✅ |
| Six téléchargements publics candidats synchronisés | ✅ |
| Scan détails d'infrastructure dans l'arbre courant | ✅ |
| Gate serveur fail-closed | ✅ |

## Inventaire documentaire

- Semaine 1 : 91 assets.
- Campagne complète : 347 assets.
- Documents finaux : 9 PDF, 28 pages.
- Téléchargements publics candidats : 6.
- Inventaire public candidat : 317 fichiers, empreinte agrégée dans `release-inventory.json`.
- Sources, dossiers enseignants, QA, rendus intermédiaires et éléments internes : classés hors kit public.

## Contrôle visuel

La planche contact des 28 pages PDF a été inspectée : pas de page blanche, pas de débordement manifeste, tarifs sur une page, filigranes SVT visibles, drapeau PROPOSITION visible sur les modules Maths, coordonnées et marque lisibles. Les planches des publications, carrousels, Stories, Reels et calendriers ont été régénérées.

## Vérifications locales déjà exécutées

- `npm run typecheck` — réussi sur les derniers lots.
- Tests TypeScript ciblés documents/sections/gates/planning/release — 51 réussis.
- Tests Python ciblés calendrier/campagnes/PDF/inventaire — 26 réussis.
- Tests contrat déploiement/environnement — 26 réussis.
- `npm run security:repo` — réussi.

## Contrôles encore requis sur le SHA final

- `npm ci`
- `npm audit --omit=dev --audit-level=high`
- lint complet
- tests unitaires complets
- tests Python complets
- snapshot/build/audit/package/verify documentaires
- build Next.js de production
- E2E avec Chromium
- contrôle des liens
- reproductibilité sur checkout propre
- workflows GitHub verts
- fils de revue résolus

## Gates humains ouverts

Validation pédagogique Maths et SVT ; affectations et qualifications ; salles ; paiement/reçu ; CGV/annulation/remboursement ; confidentialité/rétention ; date de lancement ; revue marketing ; manuels/remise ; runbook privé/rollback staging ; autorisation propriétaire.

Un résultat technique vert ne transforme pas ce document en GO commercial.
