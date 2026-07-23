# Pré-rentrée 2026 — release candidate sous gates

## Statut

**BLOCKED — READY_FOR_REVIEW uniquement.** Cette PR ne doit être ni fusionnée, ni déployée, ni publiée tant que les gates humains listés ci-dessous ne sont pas clos. `PUBLIC_READY` exige un GO écrit du propriétaire.

## Corrections P0

- Next.js corrigé et actions GitHub épinglées pour Node 24.
- Provenance reproductible : `sourceAnchorSha`, `repositoryCommitSha`, `sourceSetSha256`.
- Fondations 4–6 (max 6), Premium 3–5 (max 5).
- SNT/initiation informatique supprimée de la Seconde ; NSI conservée en Première et Terminale.
- Tarifs dérivés du référentiel canonique : 480 = 144 + 336 ; 1 350 = 405 + 945.
- Promesses non validées masquées ; formulation publique enseignants prudente.
- Gate serveur unique sur site, API, téléchargements, SEO, métadonnées et préinscription.
- Modules Maths proposés pour validation sur les BO 2019/2026 ; SVT maintenue en DRAFT.
- Trois grilles présentes dans le HTML initial ; téléchargements explicites dans Planning et Programmes.
- Kit marketing/documentaire régénéré avec calendrier relatif à une date de lancement non encore autorisée.
- Détails d'infrastructure neutralisés dans l'arbre courant ; scripts d'exploitation publics fail-closed.

## Preuves locales acquises

- TypeScript ciblé : 51 tests verts sur documents, sections, gate, planning et release.
- Python ciblé : 26 tests verts sur calendrier, campagnes, PDF et inventaire.
- Contrat déploiement/environnement : 26 tests verts.
- `npm run typecheck` : vert sur les derniers lots.
- `npm run security:repo` : clés privées, topologie publique et secrets Telegram — vert.
- Documents : 9 PDF / 28 pages rasterisées ; 6 téléchargements publics candidats synchronisés par SHA-256.
- Planning : JSON ↔ PDF contrôlé ; quatre invariants de grille verts.

La suite exhaustive, le build, l'E2E et les workflows GitHub doivent encore être rejoués sur le SHA final avant toute montée de statut.

## Gates humains ouverts

- Revue pédagogique Maths.
- Revue pédagogique SVT qualifiée et levée des DRAFT.
- Affectations, disponibilités, qualifications, salles et capacités opérationnelles.
- Revue marketing/commerciale et date de lancement.
- Paiement, reçu, CGV, annulation/remboursement.
- Confidentialité et rétention.
- Validation des téléchargements, téléphones, WhatsApp et formulaires.
- Conditions manuels/remise annuelle.
- Autorisation écrite de publication par le propriétaire.
- Runbook privé et rollback staging testés.

## Relectures demandées

- [ ] Direction pédagogique Maths
- [ ] Enseignant SVT qualifié
- [ ] Marketing/commercial
- [ ] Juridique/confidentialité
- [ ] Technique/sécurité
- [ ] Propriétaire — GO publication rattaché au SHA exact

## Interdictions

Aucun merge, aucun déploiement, aucun envoi famille et aucune activation de préinscription ne sont autorisés par cette PR.
