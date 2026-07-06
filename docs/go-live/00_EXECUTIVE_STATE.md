# État exécutif go-live

## Date

2026-07-02 14:46 CET  
Addendum Lot 0-bis : 2026-07-02 18:20 CET

## Résumé exécutif

Le dépôt local `nexus-project_v0` compile, typecheck, lint et tests unitaires passent. Le site public marketing est techniquement générable en production Next.js, et les pages critiques publiques apparaissent dans le build : `/`, `/offres`, `/recommandation`, `/bilan-gratuit`, `/stages`, `/plateforme-aria`, `/accompagnement-scolaire`, `/contact`.

Lot 0-bis a trié le smoke Playwright public : l'échec `/bilan-gratuit` venait d'un serveur standalone ancien réutilisé avec chunks `_next/static` en 404 ; le test WhatsApp exact était obsolète. Après build propre Node 20, le smoke ciblé passe : 24 tests passés, 0 échoué.

Lot 0-bis a aussi verrouillé deux angles morts marketing : Google Analytics n'est plus chargé par défaut sans variable explicite, et ClicToPay n'est plus exposé sur les pages publiques tant que l'intégration publique n'est pas activée.

La plateforme n'est pas prête pour un go-live large. Les risques bloquants sont surtout sécurité API/ownership, rate limiting distribué non prouvé en runtime, paiement carte ClicToPay non configuré, canonicalisation incomplète paiement/facture/entitlement, RGPD mineurs, stockage documents, monitoring et backup/restore.

Décision provisoire : **bêta contrôlée possible sous conditions strictes**, **go-live large non autorisé** tant qu'un P0 reste ouvert.

## Niveau de maturité actuel

- Site public : **maturité moyenne-haute avec smoke ciblé vert**, mais campagne payante encore bloquée par le statut du tunnel bilan gratuit, l'absence de CMP complète et les reliquats marketing à neutraliser.
- Tunnel bilan gratuit : **partiel**. L'UI ne demande pas de mot de passe, mais l'API crée déjà des comptes parent/élève inactifs et envoie une activation.
- Pricing public : **globalement solide** sur les pages Next.js critiques, avec source canonique `data/pricing.canonical.json` via `lib/pricing.ts` / `lib/pricing-client.ts`.
- Plateforme applicative : **maturité bêta**, pas go-live large.
- Sécurité API : **insuffisante pour ouverture large**. Inventaire statique Lot 0 : 176 routes, 44 P0, 42 P1.
- Paiement : **virement manuel actif côté code**, ClicToPay explicitement non configuré.
- IA/RAG/NPC : **fonctionnellement présent mais à verrouiller**. RAG canonique ChromaDB documenté, NPC par défaut en mode `stub`.

## Décision

- Marketing go-live : **autorisable uniquement en pré-campagne/organique avec réserves** si GA reste désactivé, ClicToPay reste masqué et la production est vérifiée ; **campagne paid Meta/Google non autorisée** tant que le tunnel bilan gratuit n'est pas aligné lead-only ou explicitement assumé avec consentement.
- Bêta contrôlée plateforme : **autorisable seulement avec utilisateurs connus, périmètre restreint, paiement carte désactivé et supervision manuelle**.
- Bêta élargie : **non autorisée à ce stade**.
- Go-live large : **non autorisé**.

## Principaux risques P0

- 44 routes API classées P0 par `node scripts/security/audit-api-guards.mjs`, dont documents, factures, bilans, coach, parent, stages, paiements et webhooks.
- Rate limiting distribué supporté par code mais non prouvé actif en production : fallback mémoire possible.
- ClicToPay retourne `501 CLICTOPAY_NOT_CONFIGURED` sur init et webhook.
- Chaîne paiement -> facture -> entitlement réelle mais partielle, avec coexistence legacy `Subscription`, crédits et `Entitlement`.
- Données de mineurs, documents PDF et bilans manipulés sans preuve complète de politique de rétention, suppression, consentement et journalisation minimisée.
- Backup/restore, monitoring, alerting et rollback non prouvés par commande de production.
- Google Analytics désormais désactivé par défaut dans `app/layout.tsx`, mais aucune CMP/consent mode complète n'existe ; activation interdite avant consentement.
- Smoke Playwright public ciblé vert en Lot 0-bis, mais warning DB e2e `business_configs` absent à traiter.

## Principaux risques P1

- Nombreux warnings lint, dont `any`, variables inutilisées et hooks.
- `next.config.mjs` ignore le lint pendant `next build`.
- Inventaires générés précédents étaient obsolètes avant régénération.
- RAG : code et documentation doivent être alignés sur l'URL par environnement.
- `lib/entitlement/types.ts` garde un registre produit distinct du pricing canonique.
- Pages/archives historiques contiennent encore des montants TND hors source canonique, même si le check officiel passe.

## Ce qui est déjà solide

- `npm run typecheck` OK.
- `npm run lint` OK avec warnings.
- `npm run test:unit -- --runInBand` OK : 504 suites passées, 1 ignorée, 6345 tests passés.
- `npm run build` OK : 143 pages générées.
- `npm run check:no-hardcoded` OK.
- `npm run check:bundle-weight` OK sur les routes publiques suivies.
- `/offres`, `/stages`, `/recommandation` et les landings SEO utilisent les getters pricing ou le contenu centralisé.
- La page contact distingue siège administratif et centre pédagogique.
- ARIA est présentée comme complément de l'humain sur les pages inspectées.

## Ce qui est bloquant

- Aucun go-live large avec P0 API ouverts.
- Aucun paiement carte tant que ClicToPay reste en `501`.
- Aucun élargissement sans preuve de rate limit distribué effectif.
- Aucun go-live plateforme sans matrice RGPD mineurs, documents, logs et droits d'accès.
- Aucun go-live production sans test restore backup et monitoring d'alerte.

## À vérifier sur production réelle

- Statut HTTP réel des pages critiques sur `https://nexusreussite.academy`.
- Mode rate limiting réel : Redis/Upstash ou mémoire.
- Présence et validité des variables ClicToPay, SMTP, Telegram, RAG, OpenAI/ARIA/NPC.
- Healthcheck public et healthcheck interne.
- Nginx, SSL, PM2 ou Docker, port exposé et headers.
- Backups, restauration testée, volume documents et stockage factures.
- Consentement analytics, Meta Pixel éventuel et journalisation réelle.
- Absence de secrets et PII excessive dans les logs runtime.

## Verdict honnête

**Non prêt pour go-live large.**

**Pas prêt pour campagne marketing payante immédiate.** Le smoke QA public ciblé est vert et GA/ClicToPay publics sont verrouillés, mais le tunnel bilan gratuit crée encore des comptes inactifs côté API et la production réelle n'a pas été vérifiée.

**Bêta contrôlée plateforme possible** uniquement avec comptes connus, données limitées, supervision humaine, paiement carte désactivé, validation manuelle des accès et monitoring renforcé.

## Réponses aux questions obligatoires Lot 0

1. Le site public peut-il être utilisé pour une campagne marketing maintenant ? **Pré-campagne organique possible avec réserves ; paid ads non.** Le smoke public ciblé est vert, mais la production réelle, le consentement analytics complet et le statut lead-only du bilan doivent être verrouillés.
2. Le tunnel bilan gratuit est-il prêt à recevoir des leads ? **Techniquement testable, mais produit/RGPD partiel.** L'UI est bas-friction et les validations Playwright passent ; l'API crée cependant des comptes inactifs avec activation email, donc le choix lead pur vs compte différé doit être figé.
3. Les prix affichés sont-ils tous issus du pricing canonique ? **Sur les pages critiques inspectées, oui majoritairement.** Le check officiel passe, mais des reliquats avec montants TND existent dans des fichiers historiques ou composants à qualifier.
4. La promesse “groupes réduits” est-elle cohérente partout ? **Globalement oui sur les pages inspectées**, avec `group_max = 5` dans le pricing canonique ; audit exhaustif contenu à finaliser.
5. Les stages de prérentrée août 2026 sont-ils bien configurés ? **Oui localement.** `pre-rentree-2026` est configuré du 24 au 28 août 2026 dans le pricing canonique.
6. La niche candidat libre est-elle correctement représentée ? **Oui localement**, via `/candidat-libre-bac-francais`, les contenus SEO et les offres libres ; validation humaine requise sur les règles session 2027.
7. Le paiement carte est-il activable ou doit-il rester désactivé ? **Il doit rester désactivé.** ClicToPay retourne `501 CLICTOPAY_NOT_CONFIGURED` et n'est plus exposé sur les pages publiques par défaut.
8. Les entitlements sont-ils la source de vérité réelle ou seulement partielle ? **Partielle.** Le flux existe, mais coexiste avec `Subscription`, crédits legacy et registre produit séparé.
9. Le rate limiting distribué est-il réellement actif ou seulement prévu ? **Seulement prévu/supporté par code localement.** Activation production Redis/Upstash non prouvée.
10. Le go-live large est-il autorisable ? **Non.** Des P0 API, RGPD, paiement, infra et monitoring restent ouverts.
11. La bêta contrôlée est-elle autorisable ? **Oui sous conditions strictes**, avec périmètre fermé, paiement carte off, supervision humaine et routes utilisées auditées.
12. Quels sont les 10 prochains tickets prioritaires ? Documents API IDOR, factures/PDF IDOR, ClicToPay webhook/init, assessments submit, bilan gratuit lead/account, coach reports `[studentId]`, stages réservations/bilans, rate limit distribué, pricing/entitlements, RGPD analytics/CMP.
13. Quelles routes API doivent être ré-auditées manuellement ? Documents, factures, paiements, bilans, assessments, coach `[studentId]`, parent PDF, stages `[stageSlug]`, NPC files/submissions, activation/abonnements.
14. Quels fichiers contiennent des montants TND hors pricing canonique ? `data/Nexus_Reussite_Accueil.html` est archive morte dans `data/`; `Nexus_Reussite_Accueil.html` racine est encore inclus dans le tracing standalone ; `components/ui/specialized-packs.tsx` est exporté mais non importé. Voir `_evidence/hardcoded-pricing-triage.md`.
15. Quels éléments RGPD/mineurs manquent encore ? CMP/consent mode, registre traitements, durée de conservation, suppression/export, sous-traitants IA/email/storage, logs redacted, politique documents, minimisation du tunnel bilan gratuit et preuve de consentement parent.
