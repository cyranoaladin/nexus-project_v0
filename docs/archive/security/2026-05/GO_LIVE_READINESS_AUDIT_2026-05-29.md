# Audit global de préparation go-live — Nexus Réussite

## Résumé exécutif
- Date : 2026-05-29.
- P0 API/IDOR : clôturable côté API/IDOR sous réserve de validation humaine, après inventaire final de 164 routes, 42 P0 statiques et 0 vrai P0 API/IDOR ouvert identifié.
- Go-live large : NON recommandé à ce stade.
- Bêta contrôlée : maintenue.
- Bêta élargie : envisageable uniquement après validation humaine produit/ops/RGPD/monitoring et traitement des conditions minimales ci-dessous.
- Décision recommandée : passer en phase P1 de préparation go-live, sans réouvrir P0-004 API/IDOR.

## Matrice de décision
| Domaine | Statut | Risque | Priorité | Décision |
|---|---|---|---|---|
| API / IDOR | P0 clôturable sous réserve humaine | Régression future | P1 suivi | Conserver CI, inventaire et tests IDOR ciblés |
| Anti-abus public | P1-A déployé production en fallback mémoire; P1-A-bis Redis local corrigé localement mais bloqué CI GitHub Actions/billing | Spam formulaires, email/Telegram, IA ou DB writes si backend distribué prod non configuré | P1 bloquant go-live large | Résoudre GitHub billing, obtenir CI verte sur `024721f92`, déployer P1-A-bis puis valider Redis local VPS via `REDIS_URL`; CAPTCHA/Turnstile à décider |
| RGPD / mineurs / PII | Incomplet | Gouvernance insuffisante des données élèves, IA, documents | P1 bloquant go-live large | Documenter politiques et procédures |
| Logs / PII | Incomplet | Emails, payloads, chemins locaux ou contenus pédagogiques possibles dans logs | P1 bloquant go-live large | Redaction centralisée et audit logs |
| Monitoring / alerting | Partiel | Incidents non détectés | P1 bloquant go-live large | Alerting 5xx, DB, disque, SMTP, RAG/NPC |
| Backups / restauration | Partiel | Restauration non prouvée | P1 bloquant go-live large | Backup DB/uploads + restore drill |
| Paiement / facturation | Partiel | Carte non prête, source financière à cadrer | P1/P2 | Garder carte désactivée tant que ClicToPay/Konnect non finalisé |
| Headers / CORS / runtime | Partiel | CSP permissive, CORS wildcard helper, artefacts sensibles présents physiquement | P1 | Durcir CSP/CORS et plan runtime minimal |
| Emails transactionnels | Partiel | Deliverability, bounce, logs email | P1/P2 | Test SMTP, redaction et suivi d'échec |
| UX critique / support / ops | Non audité fonctionnellement ici | Support insuffisant en bêta élargie | P1 | Runbook support et parcours critiques |

## Détails par domaine

### Anti-abus public
| Route | Public | Écrit DB | Déclenche email/IA | Rate limit | Distribué | CAPTCHA | Risque | Décision |
|---|---|---:|---:|---|---|---|---|---|
| `/api/bilan-gratuit` | Oui | Oui | Email | `guardRateLimitAsync` | Upstash si env, sinon mémoire | Non observé | Spam création compte/enfant | Corrigé localement P1-A |
| `/api/stages/[stageSlug]/inscrire` | Oui | Oui | Email + Telegram | `guardRateLimitAsync` | Upstash si env, sinon mémoire | Non observé | Spam inscriptions | Corrigé localement P1-A |
| `/api/stages/submit-diagnostic` | Oui | Oui | Email | `guardRateLimitAsync` | Upstash si env, sinon mémoire | Non observé | Spam diagnostic | Corrigé localement P1-A |
| `/api/assessments/submit` | Oui | Oui | Calcul/IA selon mode | `guardRateLimitAsync`, preset expensive | Upstash si env, sinon mémoire | Non observé | Coût calcul et données bruitées | Corrigé localement P1-A |
| `/api/contact` | Oui | Non direct observé | Placeholder log | `guardRateLimitAsync` | Upstash si env, sinon mémoire | Non observé | Spam futur | Corrigé localement P1-A |
| `/api/auth/reset-password` | Oui | Token reset | Email | `guardRateLimitAsync`, preset auth | Upstash si env, sinon mémoire | Non observé | Brute force/email abuse | Corrigé localement P1-A |

Constat P1-A : le helper de rate limit dispose désormais d'un mode async compatible Redis local VPS et Upstash REST, avec fallback mémoire pour dev/test et absence d'env. `RATE_LIMIT_DISABLE=1` ne désactive plus les protections en production. Le code déployé en production depuis le commit `69f0e1435` reste en fallback mémoire; P1-A-bis ajoute localement la priorité `REDIS_URL` avant Upstash pour une option gratuite. Le correctif de stabilisation tests `024721f92` est validé localement, mais la CI GitHub est bloquée par un problème Actions/billing sans jobs exécutés. L'état de gel du 2026-05-30 maintient P1-A-bis non déployé, conserve le worktree propre de reprise et suspend P1-B tant que P1-A-bis n'est pas déployé ou formellement reporté. Le document de gouvernance `docs/security/PROJECT_STATE_AND_WORKSTREAMS_2026-05-30.md` interdit aussi tout déploiement sécurité depuis le repo principal dirty, où STMG et Prisma/TOTP doivent rester des flux séparés. Une bêta élargie non conditionnelle nécessite encore la résolution CI, le déploiement P1-A-bis, l'installation/configuration Redis local sur le VPS et la validation du mode distribué.

### RGPD / mineurs / PII
| Sujet | État actuel | Risque | Priorité | Action recommandée |
|---|---|---|---|---|
| Politique confidentialité | Mentions légales/CGV présentes, procédure RGPD complète non prouvée | Information incomplète | P1 | Publier politique confidentialité et DPO/processus droits |
| Données mineurs | Données élèves, parents, bilans, conversations, documents | Sensibilité élevée | P1 | Cartographier finalités, bases légales, accès et durées |
| Export/suppression | Procédure DSAR non prouvée | Non conformité opérationnelle | P1 | Runbook export/suppression/rectification |
| Conversations IA / RAG | Données pédagogiques potentiellement persistées ou envoyées à providers | Exposition fournisseur | P1/P2 | ADR IA/RAG, clauses provider, minimisation |
| Documents et PDFs | Stockage hors public renforcé côté IDOR | Conservation/chiffrement non audités | P2 | Politique rétention et purge |

### Logs / PII
| Zone | Risque | Preuve | Priorité | Action |
|---|---|---|---|---|
| Logs API anciens | Erreurs complètes ou messages internes possibles | `console.error(..., error)` encore présent dans plusieurs routes | P1 | Normaliser logger + redaction |
| Formulaire contact | Déployé P1-A | Le log ne contient plus nom, email, téléphone ou message | P1 suivi | Poursuivre audit logs global |
| Bilan gratuit | Payload reçu loggé | `console.log('Received request body:', body)` | P1 | Supprimer ou sanitiser |
| Documents | Chemin local possible en log | `[File Read Error] File missing on disk: document.localPath` | P1 | Remplacer par id/code opaque |
| Emails | Adresses email loggées dans plusieurs helpers | `lib/email.ts`, `lib/invoice/send-email.ts` | P1 | Masquage systématique |
| Worker NPC | Erreurs et job ids loggés | `services/npc-worker/index.ts` | P2 | Redaction du contenu OCR/LLM |

### Monitoring / alerting
| Élément | État | Risque | Priorité | Action |
|---|---|---|---|---|
| `/api/health` | Vérifie app + `SELECT 1` DB | Pas SMTP/RAG/NPC/disk | P1 | Ajouter health détaillé interne |
| Sentry | Variable `SENTRY_DSN` optionnelle, intégration runtime non prouvée | 500 non alertés | P1 | Activer ou alternative alerting |
| PM2 | Déploiements vérifient `pm2 status` manuellement | Crash hors fenêtre non notifié | P1 | Alerting process/restart |
| RAG/LLM | Fonctions health présentes côté libs | Non intégrées à health opérationnel | P1/P2 | Endpoint interne et alerte |
| Worker NPC | Healthcheck Docker stub observé dans docs/grep | Worker silencieux possible | P1 | Health DB/queue/provider |
| Disk/uploads | Pas de preuve d'alerte | Saturation stockage | P1 | Alerte disque et croissance uploads |

### Backups / restauration
| Élément | État | Risque | Priorité | Action |
|---|---|---|---|---|
| Backups déploiement | Présents par lot P0 | Rollback applicatif seulement | P1 suivi | Conserver procédure |
| Backup DB quotidien | Documenté dans anciens guides/scripts, non prouvé dans cet audit | Perte de données | P1 bloquant | Vérifier cron réel et récence |
| Restore drill | Non prouvé | Backup inutilisable | P1 bloquant | Restaurer sur DB temporaire et documenter |
| Uploads/documents/PDF | Backup non prouvé | Perte documents élèves/factures | P1 | Sauvegarde fichiers + test restauration |
| RPO/RTO | Non définis | Décision incident lente | P1 | Définir objectifs et responsable |

### Paiement / facturation
| Sujet | État | Risque | Priorité | Action |
|---|---|---|---|---|
| ClicToPay init | Endpoint `501 CLICTOPAY_NOT_CONFIGURED` | Carte non prête | P1 si bêta payante carte | Garder désactivé ou finaliser |
| ClicToPay webhook | Signature prévue si secret présent, traitement TODO/501 | Paiements carte non reconciliés | P1 | Implémenter idempotence + tests sandbox |
| Konnect | Références documentaires, état non prouvé | Ambiguïté provider | P2 | ADR paiement |
| Virement manuel | Flux assistante existant | Abus opérationnel/erreur humaine | P1/P2 | Runbook validation et double contrôle selon montant |
| Factures PDF | IDOR traité en P0 | Ledger financier non canonique | P2 | Source de vérité financière |

### Headers / CORS / runtime
| Sujet | État | Risque | Priorité | Action |
|---|---|---|---|---|
| CSP | Active mais contient `unsafe-inline` et `unsafe-eval` | Impact XSS augmenté | P1 | Plan nonce/hash par étapes |
| Permissions-Policy | `camera=(), microphone=()` alors que Jitsi existe | Parcours vidéo cassable | P1 | Politique par route ou exception Jitsi |
| CORS helper | Défaut `Access-Control-Allow-Origin: *` si aucune origine fournie | Mauvaise réutilisation future | P1 | Origine explicite obligatoire |
| Dotfiles/webroot | Nginx protège en 404 | Artefacts `.env`, `.git`, `.next/standalone/.env` encore physiques en prod selon rapport P0 infra | P1 | Runtime minimal sans dépôt/secrets physiques |
| Bind applicatif | Corrigé sur `127.0.0.1:3001` en P0 infra | Régression config | P1 suivi | Smoke systématique |

### Emails transactionnels
| Sujet | État | Risque | Priorité | Action |
|---|---|---|---|---|
| SMTP | Helpers et route admin test-email présents | Config/deliverability non prouvées ici | P1 | Test contrôlé + alerte échec |
| Reset password | Anti-enumeration côté UI/API et rate limit observés | Email abuse résiduel | P1 suivi | Rate limit distribué |
| Activation élève/stage | Emails contenant tokens | Logs et bounce à contrôler | P1 | Masquage + expiration + runbook |
| Factures email | Envoi facture présent | PII dans logs possibles | P1/P2 | Redaction et tracking d'échec |
| Bounce monitoring | Non prouvé | Emails critiques perdus | P2 | Suivi bounce/retour SMTP |

### UX critique / support / ops
| Sujet | État | Risque | Priorité | Action |
|---|---|---|---|---|
| Parcours parent/élève post-auth | Tests API forts, UX non réauditée dans cette mission | Blocage utilisateur | P1 | Smoke Playwright parcours critiques |
| Support bêta | Runbooks incidents partiels | Support lent | P1 | Procédure support + escalade |
| Paiement/support | Carte non prête; virement manuel | Confusion commerciale | P1 | Message produit et protocole ops |
| Monitoring humain | Non prouvé | Incidents hors heures ouvrées | P1 | Responsable et canal alerte |

## Bloquants avant go-live large
| ID | Sujet | Risque | Action | Priorité |
|---|---|---|---|---|
| GL-P1-001 | Anti-abus distribué des routes publiques | Spam, coût IA/email, pollution DB si backend distribué non configuré | Résoudre GitHub billing, relancer CI sur `024721f92`, déployer P1-A-bis, configurer Redis local VPS via `REDIS_URL`, valider prod, puis décider CAPTCHA/Turnstile sur formulaires publics à risque | P1 |
| GL-P1-002 | Logs sans PII excessive | Fuite emails, payloads, contenus élèves | Redaction centralisée + suppression logs payload/localPath/email brut | P1 |
| GL-P1-003 | Backups et restauration | Perte DB/documents | Backup DB/uploads automatisé + restore drill daté | P1 |
| GL-P1-004 | Monitoring/alerting | Incidents non détectés | Alerting 5xx, PM2, DB, disk, SMTP, RAG/NPC | P1 |
| GL-P1-005 | RGPD mineurs | Non conformité opérationnelle | Politique confidentialité + DSAR export/suppression + rétention | P1 |
| GL-P1-006 | Paiement carte | Encaissement non fiable | Garder carte désactivée ou finaliser ClicToPay/Konnect sandbox + idempotence | P1 |
| GL-P1-007 | Runtime minimal | Secrets physiquement présents en prod | Déployer artefact sans `.git`, `.env`, sources inutiles | P1 |

## Conditions pour bêta élargie
| Condition | Statut | Action |
|---|---|---|
| P0 API/IDOR validé humainement | Prêt côté audit | Validation humaine formelle |
| Rate limit prod confirmé non désactivé | Déployé; `RATE_LIMIT_DISABLE=1` absent; fallback mémoire actif; P1-A-bis Redis local corrigé localement mais CI bloquée Actions/billing | Résoudre GitHub billing, obtenir CI verte, déployer P1-A-bis, configurer `REDIS_URL`, puis valider le mode distribué |
| Backups récents et restore drill | Non prouvé | Exécuter un test restauration |
| Alerting minimal | Non prouvé | Configurer alerte 5xx/PM2/DB/disk |
| Paiement carte | Non prêt | Désactiver explicitement en bêta ou finaliser sandbox |
| RGPD/support | Incomplet | Procédure droits utilisateurs + support bêta |
| Logs PII | Incomplet | Redaction des points P1 les plus évidents |

## Backlog P1/P2 recommandé
| Priorité | Sujet | Action |
|---|---|---|
| P1-A/P1-A-bis | Anti-abus public et rate limiting distribué | P1-A déployé; P1-A-bis Redis local corrigé localement mais bloqué par CI GitHub Actions/billing; résoudre CI, déployer puis configurer `REDIS_URL`; CAPTCHA/Turnstile reste à décider |
| P1-B | Logs/PII | Redaction logger, suppression payloads publics, tests snapshot |
| P1-C | Backup/restore + monitoring | Restore drill, alerting, health détaillé |
| P1-D | RGPD mineurs | Politique confidentialité, rétention, DSAR |
| P1-E | Headers/runtime | CSP progressive, CORS explicite, runtime minimal |
| P1-F | Paiement carte | Décision produit : désactivé ou intégration sandbox complète |
| P2 | Ledger financier, ADR RAG, accessibilité | Backlog product-ready |

## Verdict final
- Go-live large : NON recommandé et non autorisé automatiquement.
- Bêta élargie : envisageable seulement après traitement des conditions minimales P1 et validation humaine produit/ops/RGPD/monitoring.
- Bêta contrôlée : maintenue.
- Premier lot P1 recommandé : `P1-A — Anti-abus public et rate limiting distribué`, car il protège immédiatement les surfaces publiques qui écrivent en base, envoient des emails/Telegram ou peuvent déclencher du calcul.
