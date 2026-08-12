# 07 — Sécurité et données personnelles

Ce chantier ouvre une **nouvelle surface publique non authentifiée** manipulant des données de mineurs.
Il est traité au niveau d'exigence le plus haut du dépôt.

## §1. Contexte — incident de référence

Le formulaire « bilan gratuit » créait des comptes utilisateur depuis un endpoint public,
avec une vulnérabilité d'énumération de comptes. Le présent chantier ne doit pas rejouer ce schéma.
Deux règles en découlent, non négociables :

1. **Aucun endpoint public ne crée, ne modifie ni n'interroge un `User`.**
2. **Aucune réponse publique ne varie selon l'existence d'un compte ou d'un lead.**

## §2. Anti-énumération

Sur `POST /api/positionnement/attempts` :

- Même code HTTP, même corps, même forme de réponse dans tous les cas
- Écart de latence maîtrisé : chemin de traitement uniforme, pas de court-circuit précoce
  quand le lead existe déjà
- Aucun message différenciant en français (« déjà inscrit », « compte existant », « e-mail connu »)
- Notifications e-mail envoyées de façon asynchrone, après la réponse HTTP

Test d'intégration dédié — spec 06 §2.

## §3. Jeton d'accès à une passation

- 32 octets d'entropie, générateur cryptographique, encodage url-safe
- Unique et indexé ; **jamais** d'identifiant séquentiel ou devinable exposé publiquement
- Transmis en en-tête `X-Attempt-Token`, jamais en paramètre d'URL côté serveur
  (les URL finissent dans les journaux Nginx et les en-têtes `Referer`)
- Durée de vie alignée sur `expiresAt` de la passation
- Non journalisé, non inclus dans les rapports d'erreur, non transmis à un tiers

Le lien parent est un **lien signé distinct**, à durée courte (`BILAN_LINK_TTL_HOURS`),
qui ne donne accès qu'au bilan `PARENT` — jamais aux réponses brutes ni aux autres audiences.

## §4. Données collectées — minimisation

Collecté : prénom, nom, e-mail, téléphone, niveau de rentrée, réponses, confiances, temps.

**Non collecté** : date de naissance, adresse postale, établissement d'origine nominatif,
identifiant national, photo, toute donnée de santé, toute donnée relative aux parents
au-delà du contact.

Un champ non nécessaire à la production du bilan ou à la prise de contact n'est pas demandé.

## §5. Mineurs et consentement

Le public visé est majoritairement mineur.

- Le consentement est recueilli auprès du **responsable légal**, pas de l'élève.
- Case décochée par défaut, texte explicite, sans pré-cochage ni consentement implicite.
- Le refus du consentement bloque la création de la passation (`400`), sans contournement.
- Aucun profilage à finalité publicitaire. Les données de positionnement ne sont
  **jamais** transmises à Meta Ads ni à aucune plateforme publicitaire, ni sous forme
  d'audience personnalisée, ni sous forme d'événement de conversion enrichi.

## §6. Rétention

| Donnée | Durée | Après |
|---|---|---|
| Passation non soumise | 30 jours | suppression complète |
| Passation soumise + résultat | 24 mois | anonymisation : lien lead rompu, données pédagogiques conservées agrégées |
| Bilan PDF | 24 mois | suppression du fichier, métadonnées conservées |
| Lead sans suite | 24 mois après dernier contact | suppression |

Purge par tâche planifiée idempotente, journalisée, testée. Jamais de suppression manuelle en base.

## §7. Droits des personnes

À prévoir dès L1, même si l'interface n'arrive qu'en L5 :

- Accès et export : `GET /api/admin/positionnement/attempts/:id/export` produit l'ensemble
  des données rattachées à une personne, dans un format lisible
- Effacement : opération traçable qui supprime le lead et anonymise les résultats,
  sans casser les agrégats
- Point de contact publié : `contact@nexusreussite.academy`

## §8. Journalisation

Interdits de journal : `accessToken`, `rawAnswer`, e-mail, téléphone, nom, prénom.
Autorisés : `attemptId`, `testSlug`, `status`, durées, codes HTTP, agrégats.
Les rapports d'erreur (e-mail) suivent la même règle : `attemptId` seul,
jamais de charge utile.

## §9. Points d'attention pour la revue

| # | Point | Sévérité si manqué |
|---|---|---|
| S1 | Un `User` créé depuis un endpoint public | P0 |
| S2 | Réponse différenciée révélant un compte existant | P0 |
| S3 | `answerKey` exposé sur la route de passation | P0 |
| S4 | Jeton en paramètre d'URL ou journalisé | P0 |
| S5 | Route staff protégée par la seule garde client | P0 |
| S6 | Bilan PARENT accessible sans revue quand la revue est requise | P1 |
| S7 | Données de positionnement dans un événement publicitaire | P0 |
| S8 | Absence de tâche de purge | P1 |
