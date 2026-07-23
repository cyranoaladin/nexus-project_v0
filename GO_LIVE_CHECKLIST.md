# GO-LIVE CHECKLIST — Pré-rentrée SVT 2026 (une page, à cocher en une fois)

> À valider après consolidation `feat/svt-integration-final-v2`. Chaque gate : **intitulé → statut → action one-shot au GO**. `PRÊT` = rien à faire ; `REQUIERT` = bloquant direction.

| □ | Gate | Statut | Défaut / ce qui manque | Action one-shot au GO |
|---|---|---|---|---|
| □ | **1. Grille tarifaire** | ✅ **PRÊT** | Grille production 20/07 (Fondations 4-6, Premium 3-5, acomptes 30% exacts) — **scellée R1** (`commercialGridFinal`) | Aucune (déjà la référence) |
| □ | **2. Enseignant SVT** | ⛔ **REQUIERT** | Nom + qualification de `SVT_TEACHER_A/B` (aucun nom en public) | Renseigner `teacherRoles.SVT_TEACHER_A/B` + `assigned:true` |
| □ | **3. Validation programmes Maths Seconde/Première** (conformité BO 2026) | ⛔ **REQUIERT** | Relecture agrégé/direction des modules révisés | Passer `mathsProgramConformity2026.status` → `approved_for_publication` |
| □ | **4. Programmes SVT (DRAFT)** | ⛔ **REQUIERT** | Validation pédagogique direction (D2) | `svtProgramValidation.status` → `approved` + relancer le générateur (PDF SVT sans filigrane) |
| □ | **5. Salles** | ✅ **PRÊT** | 2 salles, rôles abstraits « Enseignant de … », aucun nom | Aucune |
| □ | **6. Paiement / reçu / remboursement / confidentialité** | ⛔ **REQUIERT** | Confirmation des process (gates `cancellation_and_refund_terms`, `privacy_notice_and_data_retention`) | Activer les mentions légales correspondantes (`enablePayment` reste géré séparément) |
| □ | **7. Téléchargements PDF (6 liens publics)** | ⛔ **REQUIERT** | Ton OK visuel sur les 6 PDF (`/public/documents/…`) | Exposer les 6 liens publics (déjà servis, à valider) |
| □ | **8. Tél / WhatsApp / formulaires** | ⛔ **REQUIERT** | Test bout-en-bout (préinscription active, sans paiement) | Aucune (préinscription déjà fonctionnelle) |
| □ | **9. Manuels / remise annuelle** | ⛔ **REQUIERT** | Décision direction : afficher ou masquer | Basculer l'affichage du bloc correspondant |
| □ | **10. Revue marketing + date de lancement** | ⛔ **REQUIERT** | Ta date de mise en ligne | Planifier `status` → `PRE_REGISTRATION_OPEN` / `PUBLIC_READY` à la date |
| □ | **11. Runbook / rollback staging** | ⛔ **REQUIERT** | Dry-run staging (release-dir + pm2 + symlink) | Valider `DEPLOY_RUNBOOK.md` puis autoriser le cutover |
| □ | **12. GO écrit propriétaire rattaché au SHA** | ⛔ **VERROU FINAL** | Ton GO écrit sur le SHA de `final-v2` | Merge → build release → cutover contrôlé |

**Prêt sans action** : gates 1, 5 (+ 8 techniquement, préinscription déjà active).
**Bloquant côté direction** : 2, 3, 4, 6, 7, 9, 10, 11, 12.

> Aucune de ces actions n'est déclenchée sans ta case cochée. Je ne modifie ni l'offre ni les gates moi-même.
