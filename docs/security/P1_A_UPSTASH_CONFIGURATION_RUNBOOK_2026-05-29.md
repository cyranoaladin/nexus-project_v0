# P1-A — Runbook configuration Upstash rate limiting

## Objectif
Activer le mode distribué du rate limiting public P1-A en production, sans modifier le code applicatif ni exposer de secret.

## État actuel
- Runtime : `69f0e143`
- Mode actuel : fallback mémoire
- Variables présentes :
  - `RATE_LIMIT_DISABLE_1=absent`
- Variables manquantes :
  - `UPSTASH_REDIS_REST_URL=missing`
  - `UPSTASH_REDIS_REST_TOKEN=missing`
- Impact : le code P1-A est déployé et fonctionnel, mais le rate limiting distribué n'est pas actif. Une bêta élargie non conditionnelle reste impossible tant que les variables Upstash ne sont pas configurées et validées.

## Variables nécessaires
| Variable | Description | Secret | Exemple |
|---|---|---|---|
| `UPSTASH_REDIS_REST_URL` | URL REST Upstash | Non sensible mais à traiter comme configuration production | ne pas écrire la vraie valeur |
| `UPSTASH_REDIS_REST_TOKEN` | Token REST Upstash | Oui | ne jamais écrire |
| `RATE_LIMIT_DISABLE` | Ne doit pas être à `1` en production | Non | absent |

## Procédure d'ajout manuel
1. Se connecter au serveur de production.
2. Sauvegarder `.env` sans l'afficher.
3. Éditer `.env` avec un éditeur terminal.
4. Ajouter `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN`.
5. Vérifier la présence des variables sans afficher leurs valeurs.
6. Reload PM2 avec mise à jour de l'environnement.
7. Vérifier `api_health`.
8. Tester une route publique sans créer de données sensibles.
9. Vérifier les logs filtrés.
10. Documenter le résultat.

## Commandes proposées

### Backup `.env`
```bash
cd /var/www/nexus-project_v0
TS="$(date +%Y%m%d%H%M%S)"
mkdir -p /root/nexus-backups
cp -a /var/www/nexus-project_v0/.env "/root/nexus-backups/env-before-upstash-$TS"
chmod 600 "/root/nexus-backups/env-before-upstash-$TS"
echo "ENV_BACKUP=/root/nexus-backups/env-before-upstash-$TS"
```

### Édition manuelle
```bash
cd /var/www/nexus-project_v0
nano .env
```

Ne jamais coller les valeurs Upstash dans un ticket, un commit, un rapport Markdown ou une sortie de console partagée.

### Vérification présence sans secrets
```bash
cd /var/www/nexus-project_v0
grep -q '^UPSTASH_REDIS_REST_URL=' .env && echo 'UPSTASH_REDIS_REST_URL=present' || echo 'UPSTASH_REDIS_REST_URL=missing'
grep -q '^UPSTASH_REDIS_REST_TOKEN=' .env && echo 'UPSTASH_REDIS_REST_TOKEN=present' || echo 'UPSTASH_REDIS_REST_TOKEN=missing'
grep -q '^RATE_LIMIT_DISABLE=1' .env && echo 'RATE_LIMIT_DISABLE_1=present' || echo 'RATE_LIMIT_DISABLE_1=absent'
```

### Reload contrôlé
```bash
pm2 reload nexus-prod --update-env
sleep 8
pm2 status nexus-prod --no-color
curl -so /dev/null -w "api_health:%{http_code}\n" http://127.0.0.1:3001/api/health
```

## Validation fonctionnelle
- `api_health=200`
- `/api/contact` ne retourne pas 500.
- Aucune erreur Upstash critique dans les logs.
- Si Upstash est indisponible, le fallback mémoire est attendu avec un warning contrôlé.

### Smoke proposé sans création de données sensibles
```bash
curl -s \
  -H 'Content-Type: application/json' \
  -H 'x-forwarded-for: 198.51.100.252' \
  -d '{"name":"Test","email":"test@example.com","message":"Smoke Upstash rate limit"}' \
  http://127.0.0.1:3001/api/contact \
  | head -c 700
echo
```

### Logs filtrés
```bash
pm2 logs nexus-prod --lines 120 --nostream \
  | grep -iE 'error|exception|crash|fatal|rate|limit|upstash|contact' \
  | grep -v 'CredentialsSignin\|RAG\|EAI_AGAIN\|CLICTOPAY\|favicon' \
  || echo 'Aucune nouvelle erreur critique filtrée'
```

## Test optionnel contrôlé de 429
À exécuter seulement après validation humaine, car il envoie plusieurs requêtes. Utiliser `/api/contact` avec une IP de test et un payload neutre. Ne pas utiliser de compte réel ni de données personnelles réelles.

## Rollback
1. Restaurer `.env` depuis le backup créé avant ajout des variables.
2. Reload PM2 avec `--update-env`.
3. Vérifier `api_health=200`.
4. Vérifier que la présence Upstash revient à `missing/missing`.
5. Documenter le rollback.

### Commandes rollback
```bash
cd /var/www/nexus-project_v0
cp -a /root/nexus-backups/env-before-upstash-<TS> .env
chmod 600 .env
pm2 reload nexus-prod --update-env
sleep 8
curl -so /dev/null -w "api_health:%{http_code}\n" http://127.0.0.1:3001/api/health
```

## Décision bêta élargie
- Si Upstash est configuré et validé : condition anti-abus distribuée satisfaite, sous réserve de validation humaine produit/ops/RGPD/monitoring.
- Si Upstash reste absent : bêta élargie non conditionnelle impossible; bêta contrôlée maintenue.
- Le go-live large reste non recommandé tant que les autres sujets P1 restent ouverts : logs/PII, backups/monitoring, RGPD, runtime minimal et paiement carte.
