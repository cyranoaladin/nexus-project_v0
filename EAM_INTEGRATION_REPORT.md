# Rapport intégration EAM · Nexus Réussite
# Généré le : 28 mai 2026 17:45

## Source canonique
- Répertoire prod : `<APP_DIR>`
- PM2 process : `<PROCESS_NAME>` → port `3001`
- Nginx : `nexusreussite.academy` → `127.0.0.1:3001`
- Runtime : Next.js standalone via PM2

## Git
- Branche : `main`
- Commit EAM sujet blanc : `26bd9a358 feat(eam): add premiere prep module and mock exam`
- Commit debounce : `4f4822bb6 fix(eam): add 600ms debounce on POST /api/eam/progress sync`
- Commit type timer : `a6362f548 fix(eam): use browser timer type for progress debounce`
- GitHub `origin/main` : synchronisé après Phase 4

## DB
- Container : `nexus-postgres-db`
- DB : `nexus_prod`
- Utilisateurs : `218`
- Élèves : `136`
- `eam_progress` : table présente, `1` ligne
- Données : JSON `checks` et `quiz` valides, aucune suppression, aucun reset DB

## Nettoyage disque
- Archives : `/opt/archives/nexus-backups/`
- Archives créées et vérifiées : 3 archives, environ `646M`
- Supprimé après archivage : `/opt/nexus`, `/opt/nexus_pre_realign_20260527_181712`, `<APP_DIR>_pre_realign_20260527_181712`
- Gain net observé : environ `11G`
- Volumes Docker : non touchés

## Module EAM
| Composant | Statut |
|---|---|
| `EXAM_DATE` | OK, `2026-06-08T08:00:00+02:00` |
| Auth API `/api/eam/progress` | OK, HTTP 401 sans session |
| `MockExam` | OK, contenu inédit, intégré au dashboard élève protégé |
| `data.ts` | OK, 7 modules, 59 checklist items |
| `Countdown.tsx` | OK, importe `EXAM_DATE` |
| `useEAMProgress.ts` | OK, localStorage immédiat + POST API debounce 600 ms |
| Dashboard élève | OK, `/dashboard/eleve/eam` |
| Off-limits | OK, intacts côté serveur |

## Validations Phase 4
- TypeScript : `0` erreur TS
- Build production : exit `0`
- PM2 reload : OK, `<PROCESS_NAME>` online
- HTTPS prod : HTTP `200`
- API EAM sans auth : HTTP `401`
- DB EAM : `1` ligne

## Logs
- Pas d'erreur EAM détectée après reload.
- Warnings résiduels non EAM : variable recommandée `CLICTOPAY_API_KEY` absente, anciennes requêtes Server Action, erreurs Auth credentials liées à des tentatives de connexion.

## Conclusion
`GO-LIVE READY` pour le module EAM Première : production stable, GitHub synchronisé, API protégée, progression préservée, sujet blanc intégré, responsive maintenu.

---

## Mise à jour go-live — 28 mai 2026

### HEAD final
- `027078841 feat(coach): show student EAM progress in cohort view`

### Commits additionnels
- `92035e78d feat(cockpit): add automatismes progress card`
- `867918cbb feat(cockpit): add NSI progress card for NSI students`
- `cd75f1c8e fix(ux): improve loading skeleton and dashboard error state`
- `027078841 feat(coach): show student EAM progress in cohort view`

### Spine de progression cockpit élève EDS
- `EAMCockpitSummary` : J-X, priorité du jour, `N/59` objectifs, `N/7` modules, sujet blanc si complété.
- `NsiCockpitCard` : progression NSI conditionnelle à la spécialité NSI.
- `AutomatismesCockpitCard` : séries d'automatismes tentées et réussies, masquée si aucun démarrage.
- Ordre d'affichage : EAM, NSI, Automatismes.

### Loading / Error states
- `app/dashboard/eleve/loading.tsx` : skeleton cohérent avec le cockpit.
- `app/dashboard/eleve/error.tsx` : état d'erreur accessible, bouton réessayer, retour accueil, digest affiché si présent.
- Label NPC : déjà affiché comme `Mes Diagnostics` côté navigation élève, aucun renommage nécessaire.

### Coach — visibilité EAM
- Endpoint ajouté : `GET /api/coach/students/eam-summary`.
- Réponse sans session : HTTP `401`.
- Données exposées : agrégats uniquement (`pct`, objectifs cochés, quiz faits, sujet blanc fait/non), pas de JSON brut `checks`/`quiz`.
- Vue Cohorte coach : affichage EAM par élève si une progression existe.

### Infrastructure
- Remote GitHub serveur : SSH (`git@github.com:cyranoaladin/nexus-project_v0.git`).
- DB user effectif : `nexus_admin`.
- Schéma DB réel : table utilisateurs `users` en minuscule ; `eam_progress` présent.
- Route `nsi-pratique-2026` : renommage différé au backlog après examens.

### Certifications go-live
- Tests EAM : `16/16`.
- TypeScript : `0` erreur.
- Build production : exit `0`.
- Off-limits serveur : intacts.
- PM2 : `<PROCESS_NAME>` online après reload.
- HTTPS prod : HTTP `200`.
- Dashboard sans auth : HTTP `307`.
- API EAM sans auth : HTTP `401`.
- API Coach EAM sans auth : HTTP `401`.
- DB : `users = 218`, `eam_progress = 1`.
- Mobile non authentifié : aucun overflow à `375px` et `768px`; CTA cockpit non mesurable sans session, mais les CTA cockpit utilisent `min-h-11` (44px).
- Logs PM2 filtrés EAM/NSI/automatismes : aucune nouvelle erreur applicative relevée.
