# GO-LIVE CHECKLIST — Pré-rentrée 2026 (SVT)

**Branche :** `feat/svt-integration-final-v2` · **Ancre R1 :** commit `5c580fd62` · **SHA du GO :** = tip de la branche au moment du GO (`git rev-parse HEAD`) · **Statut release :** `BLOCKED` (fail-closed)
**Règle :** aucun merge / déploiement / diffusion sans le gate **#11** (GO écrit propriétaire rattaché au SHA).
Coche chaque gate. « DÉFAUT » = recommandation prête, tu confirmes. « REQUIERT » = décision/preuve direction bloquante.

---

### □ 1. Grille tarifaire — **PRÊT** ✅ (déjà scellé R1)
- **DÉFAUT :** grille **production 20/07** — Premium 3-5 (480/900/1350/1800, acompte 30 % = 144/270/405/540) · Fondations 4-6 (350/400, commercial_exception PRE2026-3E-350).
- **Action one-shot :** *aucune* — scellé (DEBTS `B-7` RÉSOLU + `owner.json → decisions.pricingGrid`). Data conforme, tests 42/42.
- **Bloquant direction :** ❌ aucun. **Prêt.**

### □ 2. Enseignant SVT — **BLOQUANT** (B-1 / B-1bis / B-2)
- **REQUIERT :** nom + qualification vérifiée pour SVT Première **et** Terminale.
- **Action one-shot (au GO) :** renseigner `data/campaigns/pre-rentree-2026.json → teacherRoles.SVT_TEACHER_A/B` (name + `assigned:true`) ; passer `owner.json → svtProgramValidation.status` à `approved` ; **lever le watermark DRAFT** des 2 PDF SVT ; régénérer snapshot + PDF (`scripts/pre-rentree/generate_documents.py`).
- **Bloquant direction :** ✅ affectation + preuve de qualification. **Prêt côté technique** (rôles abstraits injectables).

### □ 3. Validation Maths Seconde/Première (conformité BO 2026) — **BLOQUANT** (M-1)
- **REQUIERT :** relecture écrite d'un agrégé/direction des modules révisés (BO n°14 du 2 avril 2026).
- **Action one-shot :** passer `owner.json → mathsProgramConformity2026.status` de `proposed_pending_validation` → `approved_for_publication` ; retirer la mention « proposition » des modules.
- **Bloquant direction :** ✅ relecture agrégé. **Prêt côté technique** (propositions scellées, cf. `CONFORMITE_PROGRAMMES.md`).

### □ 4. Salles — **PRÊT** ✅ (O-1)
- **DÉFAUT :** 2 salles, affichage rôles **abstraits** (aucun nom réel). Grille D4 actée (`scheduleGridFinal`).
- **Action one-shot :** *rien* (déjà approuvé pour publication).
- **Bloquant direction :** ❌ aucun, sauf si tu veux valider les capacités par créneau. **Prêt.**

### □ 5. Paiement / reçu / remboursement / confidentialité — **BLOQUANT** (O-2 / J-1 / J-2)
- **REQUIERT :** confirmation que l'encaissement, le rapprochement, le reçu, les CGV annulation/remboursement et la notice confidentialité sont testés et approuvés.
- **Action one-shot :** passer `owner.json → remainingReleaseGates` (`cancellation_and_refund_terms`, `privacy_notice_and_data_retention`) à `confirmed` ; **activer les pages légales** correspondantes.
- **Bloquant direction :** ✅ process + conseil juridique. **Prêt côté technique** (pages légales existantes, à dé-gater).

### □ 6. Validation téléchargements PDF — **BLOQUANT** (Q-1)
- **REQUIERT :** ton **OK visuel** sur les 6 documents (manifestes, poids, checksums, E2E verts).
- **Action one-shot :** **exposer les 6 liens publics** (retirer le fail-closed sur les helpers de téléchargement) ; ⚠️ dépend du gate #2 (les 2 PDF SVT restent DRAFT tant que #2 n'est pas levé).
- **Bloquant direction :** ✅ OK visuel. **Prêt côté technique** (kits/PDF régénérés).

### □ 7. Téléphone / WhatsApp / formulaires — **BLOQUANT léger** (Q-2)
- **REQUIERT :** test bout-en-bout des parcours de contact (sans collecte excessive).
- **Action one-shot :** *rien* (rien à activer ; juste valider le test).
- **Bloquant direction :** ✅ test E2E réussi. **Prêt côté technique.**

### □ 8. Manuels / remise annuelle — **BLOQUANT** (C-1)
- **REQUIERT :** décision : conditions, stock, éligibilité, non-cumul.
- **Action one-shot :** **afficher** (renseigner + activer le bloc) **ou masquer** (avantages restent cachés — défaut actuel).
- **Bloquant direction :** ✅ décision commerciale. **Défaut : masqué** jusqu'à décision.

### □ 9. Revue marketing + date de lancement — **BLOQUANT** (C-2)
- **REQUIERT :** **ta date de lancement écrite** (J1…J29 en sont dérivés) + revue marketing.
- **Action one-shot :** fixer la date propriétaire ; **planifier `PUBLIC_READY`** (le calendrier campagne 17→28 août est déjà en data ; C-2 = date de mise en ligne publique).
- **Bloquant direction :** ✅ date + revue. **Prêt côté technique.**

### □ 10. Runbook / rollback staging — **BLOQUANT** (P1)
- **REQUIERT :** dry-run staging daté ; runbook privé hors dépôt public.
- **Action one-shot :** **valider le runbook** après exercice staging (aucune cible staging fournie à ce jour → à provisionner).
- **Bloquant direction :** ✅ dry-run staging. **Non prêt** (cible staging manquante).

### □ 11. GO écrit propriétaire rattaché au SHA — **DERNIER VERROU** (D-5)
- **REQUIERT :** GO **écrit, daté, rattaché au **SHA exact du tip** de `feat/svt-integration-final-v2` au moment du GO (après clôture des gates 2/3/5/…).
- **Action one-shot :** passer `owner.json → deploymentAuthorization.status` `locked` → `released` ; `ownerDecisionsComplete: true` ; `releaseStatus: "REVIEW"` → `PUBLIC_READY` ; **alors seulement** merge/déploiement autorisés.
- **Bloquant direction :** ✅ **ce gate débloque tout.** Tant qu'il est ouvert : fail-closed total.

---

**Synthèse — ce qui reste bloquant côté DIRECTION :** #2 (enseignant SVT), #3 (relecture Maths), #5 (paiement/légal), #6 (OK visuel PDF), #7 (test contact), #8 (décision manuels), #9 (date lancement), #10 (dry-run staging), #11 (GO SHA).
**Ce qui est PRÊT / non bloquant :** #1 (grille R1 scellée), #4 (salles/rôles abstraits). Tout le technique des autres gates est en place ; il n'attend qu'une décision/preuve direction pour être dé-gaté par l'action one-shot indiquée.
