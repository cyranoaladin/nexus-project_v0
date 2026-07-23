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

- Checkout propre contrôlé au SHA `2b6abaa9a5f35aefdba42e55d41db5310a50c5b7`.
- `npm ci` : 1 272 paquets installés.
- `npm audit --omit=dev --audit-level=high` : 0 vulnérabilité.
- `npm run lint` : code 0, aucune erreur ; avertissements historiques inchangés.
- `npm run typecheck` : code 0.
- Tests unitaires complets : 575 suites et 7 025 tests réussis ; 1 suite et 4 tests déjà ignorés ; 7 snapshots réussis.
- Pipeline documentaire : 40 suites / 256 tests TypeScript et 96 tests Python réussis ; sécurité, build, audit, package et verify verts.
- Reproductibilité : 33 fichiers documentaires comparés, 0 divergence.
- Build production Next.js 15.5.21 : 144 pages statiques, validation standalone réussie, 534 fichiers statiques source/standalone identiques.
- E2E final au SHA `25ce6e3d90039f74fb896afbab6310335bf63746` : 207 tests réussis en 5,3 min.
- `npm run security:repo` : clés privées, topologie publique et secrets Telegram — vert.
- Documents : 9 PDF / 28 pages rasterisées ; 6 téléchargements publics candidats synchronisés par SHA-256.
- Planning : JSON ↔ PDF contrôlé ; quatre invariants de grille verts.
- Package parents : 33 fichiers, 4 974 356 octets, SHA-256 `4e222d50691d84731048f0b60619849674f0bbea50abfa6bc373e976c251f616`.
- Package revue : 312 fichiers, 42 837 326 octets, SHA-256 `8a83313f12ee82ba5cf11828a7a1ff76788dbb1ef7b905fb4d3de5426896aefa`.

Le premier run Python a échoué uniquement parce que Chromium n'était pas
visible depuis le clone propre ; la suite complète a été relancée avec le
cache Playwright explicite et a produit `96 passed`, sans skip ni waiver.
Le premier run E2E a identifié huit assertions obsolètes ; après correction
des tests d'état, le run complet a produit `207 passed`.

Les workflows GitHub doivent encore être observés sur le SHA poussé avant toute
montée de statut.

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
