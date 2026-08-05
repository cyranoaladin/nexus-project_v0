# RUNBOOK FINAL — Go-live Bilan (à partir du verdict A_RISQUE)
### Destinataire : Claude CLI · Suite directe du triage Phase 3

> Le triage a établi : socle technique prouvé (scoring exact vérifié à la main, chaîne passation→outbox→worker→publication→accès verte en Postgres), **aucun bug produit**. Ne restent que du travail non commencé (OpenRouter), un golden-path E2E manquant, la signature humaine (16/17 DRAFT) et le preflight infra. Worktree confirmé : `nexus-bilans-p0d-release-quality`, branche `chore/bilans-p0d-release-quality-s5`, HEAD `91b296bc4`.

## Principe directeur
Deux sorties possibles ce soir. **Le PLANCHER est garanti ; le STRETCH est optionnel et ne doit jamais bloquer le plancher.**
- **PLANCHER (recommandé)** : bilan diagnostique sans rapport LLM. Passation → scoring vérifié → FactSheet → accès. Les enseignants certifiés bâtissent le stage à partir des scores. `REAL_LLM_GENERATION` reste OFF.
- **STRETCH** : ajoute le rapport généré par OpenRouter, **si et seulement si** Phase 2 câblée + golden-path E2E vert + signé, avant le cutoff.

## Invariants (rappel, non négociables)
1. L'IA ne signe pas les packs. Signature = clic humain du validateur **qualifié dans la matière du pack**.
2. On n'allume un pack que si son parcours activé est E2E-vert **et** il est signé par un validateur compétent.
3. Clé `OPENROUTER_API_KEY` : disponible dans le `.env` racine (OK pour câblage/test local). **Vérifier que `.env` est gitignoré et que la clé n'apparaît nulle part dans l'historique git** avant tout push. En prod, la clé doit être **chargée depuis le secret prod** (`/etc/nexus/nexus-prod.env`, convention existante), pas embarquée dans le build. Jamais loggée, jamais affichée en output terminal, jamais commitée.
4. Preflight Redis + worker SMTP prod **réussi** avant d'allumer la chaîne (le worker/outbox/publication en dépend).
5. Backup DB + release de rollback confirmés avant déploiement. `SYNTHETIC_DATA_RESIDUALS` = 0 en prod.
6. Un vrai défaut se corrige, ne se masque pas. Garde-fous de purge intacts.

---

## Étape 0 — Couverture matière × validateur (à trancher d'abord)
Établis la table : chaque pack candidat au live ce soir → sa matière → validateur qualifié disponible.
- Français → **Lamia (Lettres)** ✅
- PC → **Baligh** ✅ · SVT → **Sihem** ✅
- **Maths + NSI → `cyranoaladin@gmail.com`** (le responsable, validateur maths/NSI) ✅ — compte COACH déjà actif en prod. Vérifier que `canValidatePacks=true` et la qualification maths/NSI sont bien positionnés sur ce compte.
- Toute autre matière sans validateur qualifié disponible reste DRAFT/OFF.

**GATE 0** : liste finale des packs activables ce soir = ceux qui ont un validateur qualifié. Les autres restent DRAFT/OFF.

## Étape 1 — Preflight infra prod (bloquant pour toute chaîne bilan)
`ssh root@88.99.254.59`, lecture d'abord.
- PostgreSQL : migrations 60/60, drift nul.
- **Redis** : joignable, healthcheck OK.
- **Worker SMTP / outbox** : joignable, envoi test réel vers une adresse contrôlée, drainer actif.

**GATE 1** : infra verte. Rouge → répare ou n'allume pas la chaîne. Pas de publication sans worker.

## Étape 2 — STRETCH (optionnel) : OpenRouter + golden-path
À tenter en parallèle, sous cutoff. Si ça déborde, on tombe sur le plancher sans culpabilité.
1. Câble OpenRouter (client, modèle, timeouts, retries bornés, garde-fous de coût, fallback marqué en cas d'échec — jamais de rapport vide/hallucinant silencieux). Clé chargée depuis l'env (cf. invariant 3), jamais en dur, jamais loggée.
2. Prouve `REAL_LLM_GENERATION=PASS` sur fixture (sortie conforme au schéma, parsing robuste, aucun secret en logs).
3. Écris le **golden-path E2E** manquant : un pack réel, 18 réponses → scoring → rapport LLM → accès parent/élève, piloté par le manifeste, en un seul scénario navigateur. Doit être **vert**.

**GATE 2 (stretch)** : `REAL_LLM_GENERATION=PASS` + golden-path E2E vert. Atteint avant cutoff → le rapport LLM peut être allumé sur les packs signés. Non atteint → **STRETCH abandonné pour ce soir**, on ship le plancher, LLM en fast-follow demain.

## Étape 3 — Signature humaine (par les validateurs qualifiés)
- Affiche les packs activables (Étape 0) dans l'UI de revue avec le contenu réel à relire.
- Baligh / Sihem / Lamia signent **les packs de leur matière**. Un clic = leur certification. L'IA ne clique pas.

**GATE 3** : chaque pack qu'on va allumer est VALIDATED par le bon validateur. Non signé → reste OFF.

## Étape 4 — Déploiement derrière flag
- Build standalone du SHA S5, déploiement PM2, **release précédente conservée** pour rollback.
- Flags : n'active que les packs (signés + E2E-verts). `REAL_LLM_GENERATION` ON seulement si GATE 2 atteint ; sinon OFF (mode plancher, rapport = FactSheet/scores pour les enseignants).

## Étape 5 — Smoke test prod (compte synthétique, jamais un vrai élève)
- Parcours complet sur les packs activés : inscription → passation → scoring → (rapport LLM si stretch, sinon FactSheet) → accès parent/élève.
- Vérifie qu'aucun pack non signé / hors périmètre n'est atteignable.

**GATE 5** : smoke vert. Rouge → rollback vers la release précédente.

## Étape 6 — Flip live + journal
- Flip ON les packs validés uniquement.
- Journal de go-live : SHA, migrations, packs activés + qui les a signés, mode (plancher/stretch), résultats preflight/smoke, rollback dispo, et **plan fast-follow** (LLM + golden-path + packs restants + validateur maths).

---

## Cutoff de décision (à fixer maintenant)
Choisis une heure limite ce soir (ex. T-90 min avant l'arrêt souhaité). À cette heure :
- GATE 2 atteint → ship **STRETCH** (bilan + rapport LLM) sur les packs signés.
- GATE 2 non atteint → ship **PLANCHER** (bilan sans LLM) sur les packs signés, LLM demain.

Dans les deux cas, le résultat est un go-live où **tout ce qui est allumé est vert et certifié par un humain qualifié** — donc indiscutable. Le plancher n'est pas un repli au rabais : c'est un diagnostic chiffré fiable, lu par des enseignants certifiés. C'est un excellent lancement de pré-rentrée.

## À remonter à l'utilisateur (actions humaines)
- Confirmer que la clé OpenRouter est chargée en prod depuis le secret prod (`/etc/nexus/nexus-prod.env`), pas seulement le `.env` local, et que `.env` est gitignoré / absent de l'historique.
- Signer les packs : **Lamia** (Français), **Baligh** (PC), **Sihem** (SVT), **vous** (`cyranoaladin@gmail.com` : Maths + NSI).
- Fixer le cutoff (bascule stretch → plancher).
