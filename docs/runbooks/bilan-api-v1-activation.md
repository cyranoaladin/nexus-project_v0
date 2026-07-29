# Runbook — préparation et activation contrôlée de l'API bilan gratuit v1

## Date

2026-07-29

## Portée

Ce runbook prépare l'activation de `app/api/bilan-gratuit/v1`. Il n'autorise ni
un déploiement, ni une migration de production, ni l'activation elle-même.
Chaque étape de production requiert une fenêtre et une validation explicites.

## Variables canoniques

| Variable | Secret | Valeur initiale | Rôle |
|---|---:|---|---|
| `BILAN_CANONICAL_INTAKE_ENABLED` | non | `false` | ouvre l'intake API v1 |
| `BILAN_MATHS_TERMINALE_PILOT_ENABLED` | non | `false` | pilote disciplinaire ultérieur |
| `BILAN_PROVISIONAL_RESULTS_ENABLED` | non | `false` | résultats provisoires ultérieurs |
| `BILAN_TEAM_REALTIME_ENABLED` | non | `false` | notifications temps réel ultérieures |
| `BILAN_LLM_ENRICHMENT_ENABLED` | non | `false` | enrichissement LLM ultérieur |
| `BILAN_TEAM_NOTIFICATION_EMAIL` | non | `pedagogie@nexusreussite.academy` | destinataire logique de l'outbox équipe |
| `REDIS_URL` | oui | vide | backend Redis distribué, option A |
| `UPSTASH_REDIS_REST_URL` | oui | vide | backend Upstash, option B |
| `UPSTASH_REDIS_REST_TOKEN` | oui | vide | jeton Upstash, option B |
| `RATE_LIMIT_DISTRIBUTED_TIMEOUT_MS` | non | `1500` | timeout distribué, plage 100–10000 ms |
| `DATABASE_URL` | oui | aucun défaut de production | PostgreSQL |
| `NEXTAUTH_SECRET` | oui | aucun défaut de production | sessions Auth.js |
| `NEXTAUTH_URL` | non | domaine HTTPS | origine Auth.js |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | mixte | aucun défaut de production | liens magiques |

Ne configurer qu'un mode distribué principal : `REDIS_URL`, ou la paire
Upstash complète. Redis a priorité si les deux sont présents. Aucun secret ne
doit être écrit dans Git, un log, un ticket ou une capture.

## Préconditions bloquantes

- branche validée et SHA de release enregistré ;
- sauvegarde PostgreSQL récente et restauration testée ;
- migration `20260729_add_canonical_bilan_requests` revue ;
- Redis/Upstash joignable depuis l'application ;
- SMTP joignable avec expéditeur autorisé ;
- tous les flags `BILAN_*` à `false` ;
- aucun contenu pédagogique à affecter tant qu'il est
  `HUMAN_VALIDATION_REQUIRED` ;
- validation nominative des modules envisagés ;
- dashboards d'erreurs, outbox et rate limiting accessibles.

## Ordre d'activation

### 1. Fusionner le code sans activer

Déployer le SHA approuvé avec tous les flags à `false`. Vérifier que la
configuration effective ne contient aucun flag `NEXT_PUBLIC_BILAN_*`.

Contrôle non révélateur de secret :

```bash
test "${BILAN_CANONICAL_INTAKE_ENABLED:-false}" = "false"
test "${BILAN_MATHS_TERMINALE_PILOT_ENABLED:-false}" = "false"
test "${BILAN_PROVISIONAL_RESULTS_ENABLED:-false}" = "false"
```

### 2. Appliquer la migration Prisma

Dans une fenêtre validée, utiliser uniquement :

```bash
npx prisma migrate status
npx prisma migrate deploy
```

Ne jamais utiliser `prisma db push`. Vérifier ensuite la présence de la
migration et les contraintes, sans afficher de données utilisateur.

### 3. Configurer Redis ou Upstash

Configurer le secret dans le gestionnaire de secrets, puis vérifier :

- connexion depuis le runtime ;
- incrément atomique ;
- expiration d'une clé de test non personnelle ;
- timeout inférieur ou égal à
  `RATE_LIMIT_DISTRIBUTED_TIMEOUT_MS` ;
- retour HTTP 503 lorsque le backend est volontairement indisponible sur une
  route exigeant le mode distribué.

L'absence de backend distribué en production doit bloquer l'écriture. Aucun
fallback mémoire silencieux n'est acceptable.

### 4. Valider les autres variables

Sans en afficher la valeur :

```bash
test -n "${DATABASE_URL:-}"
test -n "${NEXTAUTH_SECRET:-}"
test -n "${NEXTAUTH_URL:-}"
test -n "${SMTP_HOST:-}"
test -n "${SMTP_USER:-}"
test -n "${SMTP_PASS:-${SMTP_PASSWORD:-}}"
test -n "${BILAN_TEAM_NOTIFICATION_EMAIL:-}"
```

Vérifier que `NEXTAUTH_URL` et `NEXT_PUBLIC_APP_URL` utilisent
`https://nexusreussite.academy`.

### 5. Exécuter les smoke tests internes

Flags toujours désactivés :

- l'ancienne page `/bilan-gratuit` reste disponible ;
- la création publique `POST /api/bilan-gratuit/v1/requests` répond par son
  refus contrôlé de feature flag ;
- les routes de reprise restent inaccessibles sans un dossier et un principal
  serveur valides ; la désactivation de l'intake ne révoque pas silencieusement
  les dossiers déjà créés ;
- aucun token, email ou payload n'apparaît dans les logs ;
- la connexion Redis/Upstash et SMTP est saine ;
- l'outbox peut être observée sans lire de PII.

Activer ensuite uniquement dans un environnement interne :

- création répétée avec la même clé : une demande et un événement logique ;
- parent A ne lit ni l'enfant ni la demande du parent B ;
- lien magique : une seule consommation, y compris concurrente ;
- lien expiré/révoqué : refus neutre ;
- Redis indisponible : 503 ;
- outbox en erreur : rollback atomique de l'intake ;
- email inconnu/connu : réponse publique indifférenciée.

### 6. Valider le contenu pédagogique

Pour tout module futur :

```bash
npm run pre-rentree:pedagogy:verify
```

Exiger responsable pédagogique, enseignant disciplinaire, date, version et
hash. Tant que le statut est `HUMAN_VALIDATION_REQUIRED`, ne pas affecter,
publier ou transmettre le contenu.

### 7. Activer progressivement

Activer d'abord et uniquement :

```text
BILAN_CANONICAL_INTAKE_ENABLED=true
```

Conserver les quatre autres flags à `false`. Limiter le trafic si un mécanisme
de ciblage existe, puis effectuer les smoke tests publics autorisés sans
données réelles.

### 8. Surveiller

Surveiller au minimum :

- taux 2xx/4xx/429/503/5xx des routes v1 ;
- latence Redis/Upstash et timeouts ;
- conflits/idempotent replays ;
- créations demande/parent/enfant ;
- consommations, expirations et rejeux de liens magiques ;
- profondeur, âge et erreurs de l'outbox ;
- erreurs SMTP ;
- événements d'autorisation/IDOR sans PII ;
- taille et fréquence des logs.

## Retour arrière

1. remettre `BILAN_CANONICAL_INTAKE_ENABLED=false` ;
2. confirmer le refus contrôlé de l'API v1 ;
3. laisser les autres flags à `false` ;
4. drainer ou geler l'outbox selon l'incident ;
5. préserver toutes les demandes et traces créées ;
6. revenir au code précédent uniquement s'il est compatible avec le schéma
   additif ;
7. ne pas supprimer la migration déjà appliquée et ne pas effacer les tables.

La migration est additive. Son rollback opérationnel normal est la
désactivation du flag et le rollback applicatif compatible, pas un `DROP`.

## Critère de feu vert

L'activation publique est permise seulement si migration, Redis/Upstash, SMTP,
smoke interne, non-énumération, IDOR, rejeu, idempotence, outbox et observabilité
sont verts. Cela ne rend aucun contenu pédagogique publiable : cette décision
reste humaine et module par module.
