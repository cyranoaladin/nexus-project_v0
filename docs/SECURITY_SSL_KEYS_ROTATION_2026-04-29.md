# SECURITY SSL KEYS ROTATION - 2026-04-29

## INCIDENT REPORT

### Date
28 avril 2026

### Incident
La clé privée SSL (`nginx/ssl/privkey.pem`) a été trackée dans le dépôt Git.

### Historique
- Commit initial: `c54587085e10bbc9040fcafc75e20c23a63fcffa` (2026-02-02)
- Commit: `2ce874a29d5338827de2cfb0a9a095dcbd3a112a` (2026-02-13)
- Commit: `03d6954401bb2423cb78143a23467e85fc5633b9` (2026-04-19)

### Impact
- La clé privée est compromise
- N'importe qui ayant accès au dépôt peut déchiffrer le trafic HTTPS
- Certificat doit être rotaté immédiatement

### Correction immédiate
- Retiré du tree courant via PR P0 hardening
- Ajouté règle .gitignore robuste
- Ajouté script de garde-fou `scripts/security/check-no-private-keys.sh`

---

## PROCÉDURE DE ROTATION SSL EN PRODUCTION

### Pré-requis
- Accès SSH au serveur (88.99.254.59)
- Accès admin Let's Encrypt ou fournisseur SSL
- Backup DB et storage effectués
- Fenêtre de maintenance planifiée

### Étape 1: Backup des certificats actuels
```bash
ssh root@88.99.254.59 '
set -e
cd /opt/nexus
mkdir -p backups/ssl-$(date +%Y%m%d)
cp -r nginx/ssl backups/ssl-$(date +%Y%m%d)/
ls -lah backups/ssl-$(date +%Y%m%d)/
'
```

### Étape 2: Génération ou renouvellement du certificat

**Option A: Let's Encrypt (recommandé)**
```bash
ssh root@88.99.254.59 '
set -e
cd /opt/nexus
# Arrêter nginx temporairement
docker compose -f docker-compose.prod.yml stop nginx
# Renouveler ou générer
certbot certonly --standalone -d nexusreussite.academy -d www.nexusreussite.academy
# Copier les nouveaux certificats
cp /etc/letsencrypt/live/nexusreussite.academy/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/nexusreussite.academy/privkey.pem nginx/ssl/
# Corriger les permissions
chmod 600 nginx/ssl/privkey.pem
chmod 644 nginx/ssl/fullchain.pem
'
```

**Option B: Fournisseur SSL (DigiCert, etc.)**
1. Générer CSR sur le serveur
2. Soumettre CSR au fournisseur
3. Télécharger le certificat et la chaîne
4. Placer dans `nginx/ssl/` avec permissions correctes

### Étape 3: Vérification des permissions
```bash
ssh root@88.99.254.59 '
set -e
cd /opt/nexus
ls -lah nginx/ssl/
# Attendu:
# -rw-r--r-- 1 nexus nexus 1.3K fullchain.pem
# -rw------- 1 nexus nexus 1.7K privkey.pem
'
```

### Étape 4: Reload Nginx
```bash
ssh root@88.99.254.59 '
set -e
cd /opt/nexus
docker compose -f docker-compose.prod.yml restart nginx
sleep 5
docker compose -f docker-compose.prod.yml logs nginx
'
```

### Étape 5: Vérification HTTPS
```bash
# Test SSL
curl -I https://nexusreussite.academy
openssl s_client -connect nexusreussite.academy:443 -servername nexusreussite.academy
```

### Étape 6: Vérification absence dans Git
```bash
cd /path/to/nexus-project_v0
git ls-files nginx/ssl/
# Doit afficher uniquement: nginx/ssl/.gitkeep ou rien
git grep -n "BEGIN .*PRIVATE KEY" -- . ':!docs/**'
# Doit afficher aucun résultat
npm run security:repo
# Doit afficher: ✓ No private keys tracked
```

---

## EMPLACEMENT DES CERTIFICATS EN PRODUCTION

### Structure attendue
```
/opt/nexus/nginx/ssl/
├── .gitkeep          # Placeholder (versionné)
├── fullchain.pem     # Certificat complet (NON versionné)
└── privkey.pem       # Clé privée (NON versionné)
```

### Montage Docker
```yaml
# docker-compose.prod.yml
volumes:
  - ./nginx/ssl:/etc/nginx/ssl:ro
```

### Permissions actuelles (2026-04-28)
- `fullchain.pem`: 0644 (rw-r--r--) ✅ CORRECT
- `privkey.pem`: 0644 (rw-r--r--) ❌ **INCORRECT** - DOIT ÊTRE 600
- Propriétaire: nexus:nexus ✅ CORRECT

### Permissions attendues
- `fullchain.pem`: 644 (rw-r--r--)
- `privkey.pem`: 600 (rw-------)
- Propriétaire: nexus:nexus

---

## GARDE-FOU

### Script de vérification
```bash
npm run security:repo
```

### Ce script vérifie
1. Aucun fichier `.pem` ou `.key` tracké
2. Aucun contenu `BEGIN .*PRIVATE KEY` dans le code
3. Aucun fichier dans `nginx/ssl/` sauf `.gitkeep`

### Intégration CI
```yaml
# .github/workflows/security.yml (à créer)
- name: Check for private keys
  run: npm run security:repo
```

---

## RECOMMANDATION HISTORIQUE GIT

### Option A: Accepter historique compromis (recommandée)
- L'historique contient la clé compromise
- Mitigation: rotation complète du certificat
- Avantage: pas de rewrite historique complexe
- Inconvénient: clé compromise dans l'historique

### Option B: Purge historique (optionnel, après validation)
Si purge historique requise:
1. Backup complet du dépôt
2. Coordination avec tous les clones
3. Utilisation de `git filter-repo` ou BFG
4. Force push avec validation explicite
5. Communication à tous les contributeurs

**ATTENTION:** Ne pas faire sans validation, backup, et communication.

---

## VALIDATION

### Checklist avant go-live
- [ ] Certificat rotaté en production
- [ ] Permissions correctes (600 pour privkey.pem)
- [ ] HTTPS fonctionnel
- [ ] Aucune clé trackée dans Git
- [ ] Script security:repo passe
- [ ] Documentation complète
- [ ] Backup des anciens certificats conservé

---

## CONTACT

En cas d'incident SSL ou question sur cette procédure:
- Sécurité: security@nexusreussite.academy
- DevOps: ops@nexusreussite.academy
